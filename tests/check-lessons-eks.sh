#!/usr/bin/env bash
# Check every EKS only lesson against a dedicated EKS Auto Mode test cluster, then save the two CRDs kubeconform still skips.
# The cluster and the EFS file system are created separately, only with Charan's approval, and deleted after the run.
# This script creates nothing in AWS except what the lessons' own Try it steps create and delete.
# Usage: KCB_EKS_CLUSTER=kcb-lessons-<name> KCB_EKS_REGION=<region> KCB_EFS_ID=fs-<id> tests/check-lessons-eks.sh <1.35|1.36|1.37>
# Needs the AWS CLI signed in to the test account, kubectl, curl, and Node.js. Run from the project root.
# Set KCB_LESSON_ONLY=<id>,<id> to rerun only those lessons.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: KCB_EKS_CLUSTER=kcb-lessons-<name> KCB_EKS_REGION=<region> KCB_EFS_ID=fs-<id> $0 <1.35|1.36|1.37>" >&2
  exit 2
fi
version=$1
case "$version" in 1.35|1.36|1.37) ;; *) echo "Unsupported Kubernetes version: $version" >&2; exit 2 ;; esac
: "${KCB_EKS_CLUSTER:?Set KCB_EKS_CLUSTER to the dedicated test cluster}" "${KCB_EKS_REGION:?Set KCB_EKS_REGION}" "${KCB_EFS_ID:?Set KCB_EFS_ID}"
if [[ ! $KCB_EKS_CLUSTER =~ ^kcb-lessons-[a-z0-9-]+$ ]]; then
  echo "Use a dedicated cluster named kcb-lessons-*, never a shared one." >&2
  exit 2
fi
export AWS_PAGER="" AWS_DEFAULT_OUTPUT=json AWS_REGION=$KCB_EKS_REGION
account=$(aws sts get-caller-identity --query Account --output text)

auto=$(aws eks describe-cluster --name "$KCB_EKS_CLUSTER" --query 'cluster.[version,computeConfig.enabled]' --output text)
if [[ $auto != "$version"$'\t'True ]]; then
  echo "Expected an EKS Auto Mode cluster on Kubernetes $version, got: $auto" >&2
  exit 2
fi

mkdir -p .runtime/eks-crds
kubeconfig=$PWD/.runtime/kubeconfig-$KCB_EKS_CLUSTER
trap 'rm -f "$kubeconfig"' EXIT
aws eks update-kubeconfig --name "$KCB_EKS_CLUSTER" --kubeconfig "$kubeconfig" >/dev/null

# kubeconform skips these two kinds until their schemas are pinned. Save the cluster's CRDs so they can be.
for crd in nodepools.karpenter.sh ingressclassparams.eks.amazonaws.com; do
  kubectl --kubeconfig "$kubeconfig" get crd "$crd" -o json > ".runtime/eks-crds/$crd.json"
done

started=$(date +%s)
# Load balancers, EBS volumes, and new nodes take minutes, so each check waits up to ten.
KCB_LESSON_PLATFORM=eks KCB_LESSON_KUBECONFIG=$kubeconfig KCB_LESSON_VERSION=$version KCB_LESSON_RETRY_SECONDS=600 \
  KCB_EKS_ACCOUNT=$account KCB_EKS_CLUSTER=$KCB_EKS_CLUSTER KCB_EFS_ID=$KCB_EFS_ID \
  node --test --test-concurrency=1 tests/lesson-cluster.check.mjs
echo "EKS lessons passed on $KCB_EKS_CLUSTER (Kubernetes $version, $KCB_EKS_REGION) in $(( $(date +%s) - started )) seconds."
echo "CRDs saved in .runtime/eks-crds. Delete the cluster and the EFS file system now to stop the charges."
