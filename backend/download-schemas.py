#!/usr/bin/env python3
"""Prepare the local kubeconform schemas that the lesson and lab checks use."""

import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

SCHEMA_DIR = Path(__file__).resolve().parents[1] / ".runtime" / "schemas"
# AWS publishes no CRDs for EKS Auto Mode's NodePool and IngressClassParams. These were exported with
# tests/check-lessons-eks.sh from a dedicated EKS Auto Mode cluster on Kubernetes v1.37.1-eks-577a51e on 2026-11-20,
# keeping only the name and spec. Refresh them from a new run when Auto Mode changes either kind.
EKS_CRDS = Path(__file__).resolve().parent / "eks-crds"
KUBERNETES_VERSIONS = ("1.35.0", "1.36.0", "1.37.0")
CATALOG = "https://raw.githubusercontent.com/yannh/kubernetes-json-schema/9e1cd3c3b22e6432cbc5615a5a930f8268f14bf1"
NATIVE_SCHEMAS = (
    "configmap-v1",
    "cronjob-batch-v1",
    "daemonset-apps-v1",
    "deployment-apps-v1",
    "horizontalpodautoscaler-autoscaling-v2",
    "ingress-networking-v1",
    "ingressclass-networking-v1",
    "job-batch-v1",
    "limitrange-v1",
    "namespace-v1",
    "persistentvolumeclaim-v1",
    "poddisruptionbudget-policy-v1",
    "pod-v1",
    "replicaset-apps-v1",
    "resourcequota-v1",
    "secret-v1",
    "service-v1",
    "serviceaccount-v1",
    "statefulset-apps-v1",
    "storageclass-storage-v1",
)


def fetch(url):
    with urlopen(url, timeout=30) as response:
        return json.load(response)


def save_schema(path, schema):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(schema, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def download_native(version, name):
    folder = f"v{version}-standalone-strict"
    schema = fetch(f"{CATALOG}/{folder}/{name}.json")
    save_schema(SCHEMA_DIR / folder / f"{name}.json", schema)


def strict(node):
    # Reject unknown fields, as kubeconform's strict schemas do, unless the CRD allows them.
    if isinstance(node, dict):
        if "properties" in node and "additionalProperties" not in node and not node.get("x-kubernetes-preserve-unknown-fields"):
            node["additionalProperties"] = False
        for value in node.values():
            strict(value)
    elif isinstance(node, list):
        for value in node:
            strict(value)
    return node


def convert_eks_crd(path):
    crd = json.loads(path.read_text(encoding="utf-8"))["spec"]
    for served in crd["versions"]:
        if not served["served"]:
            continue
        schema = strict(served["schema"]["openAPIV3Schema"])
        name = f'{crd["names"]["kind"].lower()}-{crd["group"].split(".")[0]}-{served["name"]}.json'
        for version in KUBERNETES_VERSIONS:
            save_schema(SCHEMA_DIR / f"v{version}-standalone-strict" / name, schema)


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=8) as workers:
        downloads = [workers.submit(download_native, version, name) for version in KUBERNETES_VERSIONS for name in NATIVE_SCHEMAS]
        for download in downloads:
            download.result()
    for path in sorted(EKS_CRDS.glob("*.json")):
        convert_eks_crd(path)
    print(f"Prepared Kubernetes schemas in {SCHEMA_DIR}")
