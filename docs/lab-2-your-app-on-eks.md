# Lab 2 · Your app on EKS

Run the app from [Lab 1](lab-1-hello-kubernetes.md) on Amazon EKS with Auto Mode, without changing its file. Then add the parts only AWS gives you: a load balancer with a public address, a disk that outlives its Pod, and an AWS identity for a Pod. The lab takes about 40 minutes, and 25 of them are waiting for AWS to create and delete the cluster.

## What it costs

**This lab uses your AWS account, and AWS charges for every hour the cluster runs.** Do it in one sitting and finish the clean-up steps, even if something fails part way. On the AWS Free plan, the charges come out of your credits.

| What | Why the lab needs it | Pricing |
| --- | --- | --- |
| EKS cluster | Runs Kubernetes for you. $0.10 an hour on a version in standard support. | [Amazon EKS pricing](https://aws.amazon.com/eks/pricing/) |
| EKS Auto Mode fee | Auto Mode manages the machines. Charged per machine, per second, on top of EC2. | [Amazon EKS pricing](https://aws.amazon.com/eks/pricing/) |
| EC2 instances | The machines your Pods run on. Auto Mode starts them as Pods need them. | [EC2 On-Demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/) |
| Application Load Balancer | Gives the app a public address. | [Elastic Load Balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/) |
| EBS volume | The 1 GiB disk for notes. | [Amazon EBS pricing](https://aws.amazon.com/ebs/pricing/) |
| NAT gateway and public IPv4 addresses | eksctl creates a network for the cluster with these. | [Amazon VPC pricing](https://aws.amazon.com/vpc/pricing/) |

Prices depend on the Region. The [AWS Pricing Calculator](https://calculator.aws/) adds them up for yours.

## Before you start

You need:

- An AWS account, signed in with the AWS CLI as a user or role that can create EKS clusters, IAM roles, and VPCs. An administrator role works. See [Set up kubectl and eksctl](https://docs.aws.amazon.com/eks/latest/userguide/install-kubectl.html) for the permissions eksctl needs.
- [AWS CLI version 2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [eksctl](https://docs.aws.amazon.com/eks/latest/eksctl/installation.html), and `kubectl`. The start guide installs `kubectl`.
- The Lab 1 file, `hello.yaml`. You'll download it again below.

On Windows, run every command in your WSL 2 terminal. Use one terminal for the whole lab, because the next steps reuse the Region you set in it.

Check the tools and your sign-in:

```bash
aws --version
eksctl version
kubectl version --client
aws sts get-caller-identity
```

The last command prints your account number and user or role. If it prints an error, sign in first with [`aws configure`](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html) or `aws sso login`.

Choose a Region close to you. Change `us-east-1` if you want another:

```bash
export AWS_REGION=us-east-1
```

## 1. Create the cluster

```bash
mkdir -p ~/lab-2 && cd ~/lab-2
curl -fsSLO https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/templates/kubernetes/labs/hello-eks-cluster.yaml
sed -i.bak "s/region: .*/region: $AWS_REGION/" hello-eks-cluster.yaml
```

The `sed` command puts your Region into the file. The file now looks like this, with your Region:

```yaml
# Lab 2 · Your app on EKS. An EKS Auto Mode cluster, created with eksctl.
# Auto Mode launches, patches, and removes the machines for you.
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: hello-eks
  region: us-east-1
  version: "1.37"
  tags:
    lab: hello-eks
autoModeConfig:
  enabled: true
```

Create the cluster. **AWS starts charging now.**

```bash
eksctl create cluster -f hello-eks-cluster.yaml
```

This takes about 15 minutes. eksctl creates a network, the cluster, and its IAM roles, then points `kubectl` at the cluster. It ends with `EKS cluster "hello-eks" in "<your Region>" region is ready`.

```bash
kubectl get nodes
```

It prints `No resources found`. Auto Mode starts machines only when Pods need them, so a new cluster has none yet.

## 2. Deploy the Lab 1 app, unchanged

```bash
curl -fsSLO https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/templates/kubernetes/labs/hello.yaml
kubectl apply -f hello.yaml
kubectl rollout status deployment/hello -n hello --timeout=10m
kubectl get nodes
```

The rollout waits a minute or two while Auto Mode starts a machine for the Pods. Then `kubectl get nodes` shows one node. It's the same file you ran on your laptop, and it works the same way, because it uses only portable Kubernetes objects.

<!-- check: kubectl get pods -n hello --no-headers | grep -c '1/1 *Running' | grep -qx 2 -->

As in Lab 1, `kubectl port-forward -n hello service/hello 8090:80` opens the app at [localhost:8090](http://localhost:8090). You don't need it here, because the next step gives the app a public address.

## 3. Create an IAM role for a Pod

The notes Pod in the next step will act as an IAM role, without any access keys stored in Kubernetes. Create the role. Its trust policy lets only EKS Pod Identity use it:

```bash
aws iam create-role --role-name hello-notes --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"pods.eks.amazonaws.com"},"Action":["sts:AssumeRole","sts:TagSession"]}]}'
```

Link the role to the `notes` ServiceAccount in the `hello` Namespace:

```bash
aws eks create-pod-identity-association --cluster-name hello-eks --namespace hello --service-account notes --role-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/hello-notes
```

The role has no permissions, so the Pod can prove who it is but can't change anything in your account. A new link takes a few seconds to work, and EKS gives a Pod its keys only as the Pod starts. Wait a minute:

```bash
sleep 60
```

## 4. Add the EKS only pieces

Download the second file:

```bash
curl -fsSLO https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/templates/kubernetes/labs/hello-eks.yaml
```

```yaml
# Lab 2 · Your app on EKS. The EKS only pieces, added next to Lab 1's hello.yaml.
# IngressClassParams holds the load balancer settings. internet-facing lets your browser reach it.
apiVersion: eks.amazonaws.com/v1
kind: IngressClassParams
metadata:
  name: public-alb
spec:
  scheme: internet-facing
---
# The IngressClass tells EKS Auto Mode to build Application Load Balancers with those settings.
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: public-alb
spec:
  controller: eks.amazonaws.com/alb
  parameters:
    apiGroup: eks.amazonaws.com
    kind: IngressClassParams
    name: public-alb
---
# The Ingress sends every request to the hello Service. The load balancer checks /healthz, which needs no login.
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello
  namespace: hello
  annotations:
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
spec:
  ingressClassName: public-alb
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: hello
                port:
                  number: 80
---
# The StorageClass tells EKS Auto Mode to make encrypted gp3 EBS volumes.
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: auto-ebs
provisioner: ebs.csi.eks.amazonaws.com
volumeBindingMode: WaitForFirstConsumer
parameters:
  type: gp3
  encrypted: "true"
---
# The PersistentVolumeClaim asks for a 1 GiB disk that outlives any Pod.
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: notes-disk
  namespace: hello
spec:
  storageClassName: auto-ebs
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
# The ServiceAccount is the name Pod Identity links to an IAM role.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: notes
  namespace: hello
---
# The script asks EKS for the Pod's temporary AWS keys, then asks AWS who the Pod is.
apiVersion: v1
kind: ConfigMap
metadata:
  name: notes-scripts
  namespace: hello
data:
  aws-whoami.sh: |
    creds=$(curl -s -H "Authorization: $(cat "$AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE")" "$AWS_CONTAINER_CREDENTIALS_FULL_URI")
    field() { echo "$creds" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }
    curl -s --aws-sigv4 "aws:amz:us-east-1:sts" --user "$(field AccessKeyId):$(field SecretAccessKey)" \
      -H "x-amz-security-token: $(field Token)" \
      "https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15" | sed -n "s:.*<Arn>\(.*\)</Arn>.*:\1:p"
---
# The notes Deployment runs one Pod with the disk at /data and the notes ServiceAccount.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notes
  namespace: hello
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: notes
  template:
    metadata:
      labels:
        app: notes
    spec:
      serviceAccountName: notes
      securityContext:
        runAsNonRoot: true
        fsGroup: 101
      containers:
        - name: notes
          image: nginxinc/nginx-unprivileged:1.30.4@sha256:a5866218f05961c7651a4a4a18d9bd0e5e5b4b26aafffb334df3423948db3560
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
            limits:
              memory: 64Mi
          volumeMounts:
            - name: disk
              mountPath: /data
            - name: scripts
              mountPath: /scripts
      volumes:
        - name: disk
          persistentVolumeClaim:
            claimName: notes-disk
        - name: scripts
          configMap:
            name: notes-scripts
```

| Objects | What they add | Lessons |
| --- | --- | --- |
| IngressClassParams, IngressClass, Ingress | An internet-facing Application Load Balancer in front of the `hello` Service. | Reach many apps through one address |
| StorageClass, PersistentVolumeClaim | An encrypted 1 GiB EBS volume. | Keep data on an EBS disk |
| ServiceAccount, ConfigMap, Deployment `notes` | One Pod that mounts the disk at `/data` and acts as the `hello-notes` role. `fsGroup: 101` lets the image's normal user write to the disk. | Let a Pod call AWS safely, Stop, then start |

The `notes` Deployment uses `Recreate`, because an EBS volume attaches to one machine at a time. The old Pod must stop before the new one can use the disk.

Apply it:

```bash
kubectl apply -f hello-eks.yaml
kubectl rollout status deployment/notes -n hello --timeout=10m
```

## 5. Open the app through the load balancer

AWS takes a few minutes to build the load balancer. Run this until ADDRESS shows a name ending in `elb.amazonaws.com`:

```bash
kubectl get ingress hello -n hello
```

<!-- check: kubectl get ingress hello -n hello -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' | grep -q 'elb\.amazonaws\.com$' -->

Print the app's address:

```bash
echo "http://$(kubectl get ingress hello -n hello -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
```

Open it in your browser and sign in as `learner` with the password `kubernetes`. If the page doesn't load, wait two minutes and refresh: the load balancer's name takes a little while to reach DNS servers, and it waits until a Pod passes its health check.

<!-- check: curl -fsS -u learner:kubernetes "http://$(kubectl get ingress hello -n hello -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')/" | grep -q '<h1>Hello Kubernetes</h1><p>Served by Pod hello-' -->
<!-- check: for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS -u learner:kubernetes "http://$(kubectl get ingress hello -n hello -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')/"; done | sort -u | grep -c 'Served by Pod' | grep -qx 2 -->

Refresh a few times. Unlike the `port-forward` tunnel in Lab 1, the load balancer shares requests between both Pods, so the Pod name changes.

## 6. Keep a note on the disk

Write a note to the disk, then read it back:

```bash
kubectl exec -n hello deploy/notes -- sh -c 'echo "Written by $HOSTNAME" >> /data/notes.txt'
kubectl exec -n hello deploy/notes -- cat /data/notes.txt
```

It prints `Written by notes-` and the Pod's name. Now delete the Pod. The Deployment starts a new one, which gets the same disk:

```bash
kubectl delete pod -n hello -l app=notes
kubectl rollout status deployment/notes -n hello --timeout=10m
kubectl exec -n hello deploy/notes -- cat /data/notes.txt
```

<!-- check: kubectl exec -n hello deploy/notes -- cat /data/notes.txt | grep -q '^Written by notes-' -->

The note is still there, written by a Pod that no longer exists. Without the PersistentVolumeClaim, the file would have gone with the old Pod.

See the disk in AWS:

```bash
aws ec2 describe-volumes --volume-ids $(kubectl get pv -o jsonpath='{.items[0].spec.csi.volumeHandle}') --query 'Volumes[0].[VolumeId,Size,VolumeType,Encrypted,State]' --output text
```

It prints the volume ID, `1`, `gp3`, `True`, and `in-use`.

<!-- check: aws ec2 describe-volumes --volume-ids $(kubectl get pv -o jsonpath='{.items[0].spec.csi.volumeHandle}') --query 'Volumes[0].[VolumeId,Size,VolumeType,Encrypted,State]' --output text | grep -Eq '^vol-[0-9a-f]+[[:space:]]+1[[:space:]]+gp3[[:space:]]+True[[:space:]]+in-use$' -->
<!-- check: aws ec2 describe-volumes --filters Name=tag:kubernetes.io/created-for/pvc/name,Values=notes-disk --query 'Volumes[].VolumeId' --output text | grep -q '^vol-' -->
<!-- check: aws elbv2 describe-load-balancers --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-hello-')].LoadBalancerName" --output text | grep -q '^k8s-hello-' -->
<!-- check: aws ec2 describe-instances --include-managed-resources --filters Name=tag:eks:eks-cluster-name,Values=hello-eks Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId' --output text | grep -q '^i-' -->
<!-- check: aws ec2 describe-vpcs --filters Name=tag:alpha.eksctl.io/cluster-name,Values=hello-eks --query 'Vpcs[].VpcId' --output text | grep -q '^vpc-' -->

## 7. Ask AWS who the Pod is

```bash
kubectl exec -n hello deploy/notes -- sh /scripts/aws-whoami.sh
```

It prints an ARN like `arn:aws:sts::111122223333:assumed-role/hello-notes/eks-hello-eks-notes-...`. AWS sees the Pod as the `hello-notes` role. EKS handed the Pod temporary keys that expire on their own, and no keys are stored in any file. To let the Pod do real work, such as read an S3 bucket, attach a policy to the role.

<!-- check: kubectl exec -n hello deploy/notes -- sh /scripts/aws-whoami.sh | grep -q ':assumed-role/hello-notes/' -->

If it prints nothing, the Pod started before the link worked. Run `kubectl rollout restart deployment/notes -n hello`, wait for it, and try again.

## 8. Clean up

Delete things in this order, so Kubernetes can remove what it created in AWS before the cluster goes. Deleting the Ingress removes the load balancer, and deleting the PersistentVolumeClaim removes the EBS volume. Each delete waits until that's done.

```bash
kubectl delete -f hello-eks.yaml
kubectl delete -f hello.yaml
aws eks delete-pod-identity-association --cluster-name hello-eks --association-id $(aws eks list-pod-identity-associations --cluster-name hello-eks --namespace hello --service-account notes --query 'associations[0].associationId' --output text)
aws iam delete-role --role-name hello-notes
eksctl delete cluster -f hello-eks-cluster.yaml --wait
```

Deleting the cluster takes about 10 minutes and removes its machines, network, and IAM roles.

Check that nothing is left. Each command should print an empty list, `[]`:

```bash
aws eks list-clusters --query "clusters[?@=='hello-eks']"
aws elbv2 describe-load-balancers --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-hello-')].LoadBalancerName"
aws ec2 describe-volumes --filters Name=tag:kubernetes.io/created-for/pvc/name,Values=notes-disk --query 'Volumes[].VolumeId'
aws ec2 describe-instances --include-managed-resources --filters Name=tag:eks:eks-cluster-name,Values=hello-eks Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId'
aws ec2 describe-vpcs --filters Name=tag:alpha.eksctl.io/cluster-name,Values=hello-eks --query 'Vpcs[].VpcId'
aws iam list-roles --query "Roles[?RoleName=='hello-notes'].RoleName"
```

They look for the cluster, the load balancer (Auto Mode names it after the `hello` Namespace), the notes disk, the machines Auto Mode started, which `--include-managed-resources` shows, and the network eksctl made, with its NAT gateway.

<!-- check: test "$(aws eks list-clusters --query "clusters[?@=='hello-eks']" --output text)" = "" -->
<!-- check: test "$(aws elbv2 describe-load-balancers --query "LoadBalancers[?starts_with(LoadBalancerName, 'k8s-hello-')].LoadBalancerName" --output text)" = "" -->
<!-- check: test "$(aws ec2 describe-volumes --filters Name=tag:kubernetes.io/created-for/pvc/name,Values=notes-disk --query 'Volumes[].VolumeId' --output text)" = "" -->
<!-- check: test "$(aws ec2 describe-instances --include-managed-resources --filters Name=tag:eks:eks-cluster-name,Values=hello-eks Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId' --output text)" = "" -->
<!-- check: test "$(aws ec2 describe-vpcs --filters Name=tag:alpha.eksctl.io/cluster-name,Values=hello-eks --query 'Vpcs[].VpcId' --output text)" = "" -->
<!-- check: test "$(aws iam list-roles --query "Roles[?RoleName=='hello-notes'].RoleName" --output text)" = "" -->

If something is still listed, wait a few minutes and run the checks again. AWS can take a while to remove resources. If it stays, delete it in the [AWS console](https://console.aws.amazon.com/) so it stops costing money.

## What you did

- Created an EKS Auto Mode cluster from a short eksctl file.
- Ran the Lab 1 file on EKS without changing it.
- Gave the app a public address with an Ingress and an Application Load Balancer.
- Kept data on an EBS disk while its Pod was replaced.
- Gave a Pod an AWS identity with Pod Identity, without storing keys.
- Deleted everything and checked that nothing was left running.
