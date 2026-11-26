#!/usr/bin/env bash
# Check every EKS only lesson against a dedicated EKS Auto Mode test cluster, and save the cluster's NodePool and IngressClassParams CRDs.
# Create the cluster and EFS file system first with tests/eks-lessons-cluster.sh, only with Charan's approval, and delete them after the run.
# This script creates nothing in AWS except what the lessons' own Try it steps create and delete.
# Usage: LKME_EKS_CLUSTER=lkme-lessons-<name> LKME_EKS_REGION=<region> LKME_EFS_ID=fs-<id> tests/check-lessons-eks.sh <1.35|1.36|1.37>
# Needs the AWS CLI signed in to the test account, kubectl, curl, and Node.js. Run from the project root.
# Set LKME_LESSON_ONLY=<id>,<id> to rerun only those lessons.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: LKME_EKS_CLUSTER=lkme-lessons-<name> LKME_EKS_REGION=<region> LKME_EFS_ID=fs-<id> $0 <1.35|1.36|1.37>" >&2
  exit 2
fi
version=$1
case "$version" in 1.35|1.36|1.37) ;; *) echo "Unsupported Kubernetes version: $version" >&2; exit 2 ;; esac
: "${LKME_EKS_CLUSTER:?Set LKME_EKS_CLUSTER to the dedicated test cluster}" "${LKME_EKS_REGION:?Set LKME_EKS_REGION}" "${LKME_EFS_ID:?Set LKME_EFS_ID}"
if [[ ! $LKME_EKS_CLUSTER =~ ^lkme-lessons-[a-z0-9-]+$ ]]; then
  echo "Use a dedicated cluster named lkme-lessons-*, never a shared one." >&2
  exit 2
fi
export AWS_PAGER="" AWS_DEFAULT_OUTPUT=json AWS_REGION=$LKME_EKS_REGION
account=$(aws sts get-caller-identity --query Account --output text)

auto=$(aws eks describe-cluster --name "$LKME_EKS_CLUSTER" --query 'cluster.[version,computeConfig.enabled]' --output text)
if [[ $auto != "$version"$'\t'True ]]; then
  echo "Expected an EKS Auto Mode cluster on Kubernetes $version, got: $auto" >&2
  exit 2
fi

mkdir -p .runtime/eks-crds
kubeconfig=$PWD/.runtime/kubeconfig-$LKME_EKS_CLUSTER
trap 'rm -f "$kubeconfig"' EXIT
aws eks update-kubeconfig --name "$LKME_EKS_CLUSTER" --kubeconfig "$kubeconfig" >/dev/null

# backend/eks-crds pins these two CRDs. Save the cluster's copies so a change in Auto Mode shows up as a diff.
for crd in nodepools.karpenter.sh ingressclassparams.eks.amazonaws.com; do
  kubectl --kubeconfig "$kubeconfig" get crd "$crd" -o json > ".runtime/eks-crds/$crd.json"
done

started=$(date +%s)
# Load balancers, EBS volumes, and new nodes take minutes, so each check waits up to ten.
LKME_LESSON_PLATFORM=eks LKME_LESSON_KUBECONFIG=$kubeconfig LKME_LESSON_VERSION=$version LKME_LESSON_RETRY_SECONDS=600 \
  LKME_EKS_ACCOUNT=$account LKME_EKS_CLUSTER=$LKME_EKS_CLUSTER LKME_EFS_ID=$LKME_EFS_ID \
  node --test --test-concurrency=1 tests/lesson-cluster.check.mjs
echo "EKS lessons passed on $LKME_EKS_CLUSTER (Kubernetes $version, $LKME_EKS_REGION) in $(( $(date +%s) - started )) seconds."
echo "CRDs saved in .runtime/eks-crds. Delete the cluster now to stop the charges: tests/eks-lessons-cluster.sh delete"
