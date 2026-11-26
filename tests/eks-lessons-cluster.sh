#!/usr/bin/env bash
# Create or delete the dedicated EKS Auto Mode test cluster that tests/check-lessons-eks.sh needs, with EFS for lesson 18.
# AWS charges for the cluster while it runs. Create it only with Charan's approval of the account, Region, and budget,
# and delete it as soon as the check finishes.
# Usage:
#   LKME_EKS_CLUSTER=lkme-lessons-<name> LKME_EKS_REGION=<region> tests/eks-lessons-cluster.sh create <1.35|1.36|1.37>
#   LKME_EKS_CLUSTER=lkme-lessons-<name> LKME_EKS_REGION=<region> tests/eks-lessons-cluster.sh delete
# create prints the EFS file system ID on its last line, for LKME_EFS_ID. Run from the project root.
# Needs the AWS CLI signed in to the test account, eksctl, and kubectl. Everything it creates is tagged project=lkme-lessons.
set -uo pipefail

: "${LKME_EKS_CLUSTER:?Set LKME_EKS_CLUSTER to lkme-lessons-<name>}" "${LKME_EKS_REGION:?Set LKME_EKS_REGION}"
if [[ ! $LKME_EKS_CLUSTER =~ ^lkme-lessons-[a-z0-9-]+$ ]]; then
  echo "Use a dedicated cluster named lkme-lessons-*, never a shared one." >&2
  exit 2
fi
export AWS_PAGER="" AWS_DEFAULT_OUTPUT=json AWS_REGION=$LKME_EKS_REGION
cluster=$LKME_EKS_CLUSTER
role=$cluster-efs-csi-driver
group=$cluster-efs
config=.runtime/eks/$cluster.yaml
mkdir -p .runtime/eks

create() {
  set -e
  local version=$1
  case "$version" in 1.35|1.36|1.37) ;; *) echo "Unsupported Kubernetes version: $version" >&2; exit 2 ;; esac
  cat > "$config" <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: $cluster
  region: $LKME_EKS_REGION
  version: "$version"
  tags:
    project: lkme-lessons
autoModeConfig:
  enabled: true
EOF
  aws eks describe-cluster --name "$cluster" >/dev/null 2>&1 || eksctl create cluster -f "$config" --kubeconfig ".runtime/kubeconfig-$cluster" >&2

  # EFS for lesson 18, following https://docs.aws.amazon.com/eks/latest/userguide/efs-csi.html
  local account vpc cidr private sg fs existing
  account=$(aws sts get-caller-identity --query Account --output text)
  vpc=$(aws eks describe-cluster --name "$cluster" --query cluster.resourcesVpcConfig.vpcId --output text)
  cidr=$(aws ec2 describe-vpcs --vpc-ids "$vpc" --query 'Vpcs[0].CidrBlock' --output text)
  private=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$vpc" Name=tag:kubernetes.io/role/internal-elb,Values=1 --query 'Subnets[].SubnetId' --output text)
  # The driver's role, trusted only by EKS Pod Identity.
  if ! aws iam get-role --role-name "$role" >/dev/null 2>&1; then
    aws iam create-role --role-name "$role" --tags Key=project,Value=lkme-lessons --assume-role-policy-document \
      '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"pods.eks.amazonaws.com"},"Action":["sts:AssumeRole","sts:TagSession"]}]}' >/dev/null
    aws iam attach-role-policy --role-name "$role" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy
  fi
  if ! aws eks describe-addon --cluster-name "$cluster" --addon-name aws-efs-csi-driver >/dev/null 2>&1; then
    aws eks create-addon --cluster-name "$cluster" --addon-name aws-efs-csi-driver \
      --pod-identity-associations "serviceAccount=efs-csi-controller-sa,roleArn=arn:aws:iam::$account:role/$role" --tags project=lkme-lessons >/dev/null
  fi
  # NFS from inside the VPC only.
  sg=$(aws ec2 describe-security-groups --filters Name=vpc-id,Values="$vpc" Name=group-name,Values="$group" --query 'SecurityGroups[0].GroupId' --output text)
  if [[ $sg == None ]]; then
    sg=$(aws ec2 create-security-group --vpc-id "$vpc" --group-name "$group" --description "NFS for $cluster EFS" \
      --tag-specifications 'ResourceType=security-group,Tags=[{Key=project,Value=lkme-lessons}]' --query GroupId --output text)
    aws ec2 authorize-security-group-ingress --group-id "$sg" --protocol tcp --port 2049 --cidr "$cidr" >/dev/null
  fi
  fs=$(aws efs describe-file-systems --query "FileSystems[?Name=='$cluster'].FileSystemId | [0]" --output text)
  if [[ $fs == None ]]; then
    fs=$(aws efs create-file-system --encrypted --creation-token "$cluster" --tags Key=Name,Value="$cluster" Key=project,Value=lkme-lessons --query FileSystemId --output text)
  fi
  until [[ $(aws efs describe-file-systems --file-system-id "$fs" --query 'FileSystems[0].LifeCycleState' --output text) == available ]]; do sleep 5; done
  existing=$(aws efs describe-mount-targets --file-system-id "$fs" --query 'MountTargets[].SubnetId' --output text)
  for subnet in $private; do
    [[ " $existing " == *" $subnet "* ]] || aws efs create-mount-target --file-system-id "$fs" --subnet-id "$subnet" --security-groups "$sg" >/dev/null
  done
  until [[ -z $(aws efs describe-mount-targets --file-system-id "$fs" --query "MountTargets[?LifeCycleState!='available'].MountTargetId" --output text) ]]; do sleep 10; done
  until [[ $(aws eks describe-addon --cluster-name "$cluster" --addon-name aws-efs-csi-driver --query addon.status --output text) == ACTIVE ]]; do sleep 10; done
  echo "$fs"
}

delete() {
  local kubeconfig=.runtime/kubeconfig-teardown-$cluster
  if aws eks describe-cluster --name "$cluster" >/dev/null 2>&1; then
    aws eks update-kubeconfig --name "$cluster" --kubeconfig "$kubeconfig" >/dev/null
    # Load balancers and volumes belong to Kubernetes objects, so delete those objects while the cluster can still clean up.
    kubectl --kubeconfig "$kubeconfig" delete ingress --all -n default --ignore-not-found --wait=true
    kubectl --kubeconfig "$kubeconfig" delete service -n default --field-selector metadata.name!=kubernetes --ignore-not-found --wait=true
    kubectl --kubeconfig "$kubeconfig" delete statefulset,deployment,pod,pvc --all -n default --ignore-not-found --wait=true
    kubectl --kubeconfig "$kubeconfig" delete nodepool flex --ignore-not-found --wait=true
    kubectl --kubeconfig "$kubeconfig" delete storageclass auto-ebs efs --ignore-not-found
    kubectl --kubeconfig "$kubeconfig" delete ingressclass,ingressclassparams public-alb --ignore-not-found
    rm -f "$kubeconfig"
  fi
  for assoc in $(aws eks list-pod-identity-associations --cluster-name "$cluster" --query 'associations[?serviceAccount==`aws-caller`].associationId' --output text 2>/dev/null); do
    aws eks delete-pod-identity-association --cluster-name "$cluster" --association-id "$assoc" >/dev/null
  done
  aws iam delete-role --role-name lkme-pod-identity-demo 2>/dev/null

  local fs mt ap vpc sg
  fs=$(aws efs describe-file-systems --query "FileSystems[?Name=='$cluster'].FileSystemId | [0]" --output text)
  if [[ $fs != None ]]; then
    for mt in $(aws efs describe-mount-targets --file-system-id "$fs" --query 'MountTargets[].MountTargetId' --output text); do aws efs delete-mount-target --mount-target-id "$mt"; done
    until [[ $(aws efs describe-mount-targets --file-system-id "$fs" --query 'length(MountTargets)') == 0 ]]; do sleep 10; done
    for ap in $(aws efs describe-access-points --file-system-id "$fs" --query 'AccessPoints[].AccessPointId' --output text); do aws efs delete-access-point --access-point-id "$ap"; done
    aws efs delete-file-system --file-system-id "$fs"
  fi
  aws eks delete-addon --cluster-name "$cluster" --addon-name aws-efs-csi-driver >/dev/null 2>&1
  aws iam detach-role-policy --role-name "$role" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy 2>/dev/null
  aws iam delete-role --role-name "$role" 2>/dev/null
  vpc=$(aws ec2 describe-vpcs --filters Name=tag:alpha.eksctl.io/cluster-name,Values="$cluster" --query 'Vpcs[0].VpcId' --output text)
  sg=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$group" --query 'SecurityGroups[0].GroupId' --output text)
  # The EFS network interfaces take a moment to go after the mount targets.
  [[ $sg != None ]] && for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do aws ec2 delete-security-group --group-id "$sg" 2>/dev/null && break; sleep 10; done

  [[ -f $config ]] && eksctl delete cluster -f "$config" --wait
  [[ -f $config ]] || eksctl delete cluster --name "$cluster" --region "$LKME_EKS_REGION" --wait

  echo "--- Left behind (each list should be empty) ---"
  echo "EKS cluster: $(aws eks list-clusters --query "clusters[?@=='$cluster']" --output text)"
  # The lessons run in the default Namespace, and Auto Mode names load balancers k8s-<namespace>-.
  # The tagging API is not used here, because it keeps listing deleted resources for a while.
  echo "Load balancers: $(aws elbv2 describe-load-balancers --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-default-')].LoadBalancerName" --output text)"
  echo "Running instances: $(aws ec2 describe-instances --include-managed-resources --filters Name=tag:eks:eks-cluster-name,Values="$cluster" Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId' --output text)"
  echo "EFS file systems: $(aws efs describe-file-systems --query "FileSystems[?Name=='$cluster'].FileSystemId" --output text)"
  echo "VPC $vpc: $(aws ec2 describe-vpcs --vpc-ids "$vpc" --query 'Vpcs[].VpcId' --output text 2>/dev/null)"
  echo "IAM roles: $(aws iam list-roles --query "Roles[?RoleName=='$role' || RoleName=='lkme-pod-identity-demo' || contains(RoleName, 'eksctl-$cluster')].RoleName" --output text)"
  rm -f "$config"
}

case "${1:-}" in
  create) create "${2:-}" ;;
  delete) delete ;;
  *) echo "Usage: LKME_EKS_CLUSTER=lkme-lessons-<name> LKME_EKS_REGION=<region> $0 create <1.35|1.36|1.37> | delete" >&2; exit 2 ;;
esac
