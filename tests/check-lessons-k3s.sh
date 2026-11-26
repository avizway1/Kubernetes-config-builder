#!/usr/bin/env bash
# Create a fresh K3s cluster with k3d, apply every Anywhere lesson, check each Try it result, then delete the cluster.
# Lessons run on one node, as on a new practice cluster. Then two worker nodes join for the lessons that need three.
# Usage: tests/check-lessons-k3s.sh <1.35|1.36|1.37>   (run from the project root, with Docker running)
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <1.35|1.36|1.37>" >&2
  exit 2
fi
version=$1
# The same K3s releases as the other deploy checks (docs/local-rendering.md).
case "$version" in
  1.35) image=rancher/k3s:v1.35.10-k3s1 port=6561 ;;
  1.36) image=rancher/k3s:v1.36.6-k3s1 port=6562 ;;
  1.37) image=rancher/k3s:v1.37.2-k3s1 port=6563 ;;
  *) echo "Unsupported Kubernetes version: $version" >&2; exit 2 ;;
esac
cluster=lkme-lessons-${version//./}
mkdir -p .runtime
kubeconfig=$PWD/.runtime/kubeconfig-$cluster

if k3d cluster list "$cluster" >/dev/null 2>&1; then
  echo "Cluster $cluster already exists. Delete it with: k3d cluster delete $cluster" >&2
  exit 2
fi
cleanup() {
  k3d cluster delete "$cluster" >/dev/null 2>&1 || true
  rm -f "$kubeconfig"
}
trap cleanup EXIT

started=$(date +%s)
k3d cluster create "$cluster" --image "$image" --api-port "127.0.0.1:$port" \
  --kubeconfig-update-default=false --kubeconfig-switch-context=false --wait
k3d kubeconfig get "$cluster" > "$kubeconfig"
kubectl --kubeconfig "$kubeconfig" wait --for=condition=Ready nodes --all --timeout=120s
# The default ServiceAccount appears shortly after the cluster starts. Pods cannot be created without it.
until kubectl --kubeconfig "$kubeconfig" get serviceaccount default >/dev/null 2>&1; do sleep 2; done

LKME_LESSON_KUBECONFIG=$kubeconfig LKME_LESSON_VERSION=$version LKME_LESSON_NODES=1 \
  node --test --test-concurrency=1 tests/lesson-cluster.check.mjs
# The same command the scheduling lessons give learners, with this cluster's name and image.
k3d node create "$cluster-worker" --cluster "$cluster" --role agent --replicas 2 --image "$image" --wait
kubectl --kubeconfig "$kubeconfig" wait --for=condition=Ready nodes --all --timeout=120s
LKME_LESSON_KUBECONFIG=$kubeconfig LKME_LESSON_VERSION=$version LKME_LESSON_NODES=3 \
  node --test --test-concurrency=1 tests/lesson-cluster.check.mjs
echo "Lessons passed on K3s $version ($image) in $(( $(date +%s) - started )) seconds, $(uname -m)."
