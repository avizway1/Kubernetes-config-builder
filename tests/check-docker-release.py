"""Smoke-test the Docker distribution on localhost."""

import json
import re
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8080"


def request(path, payload=None):
    options = {}
    if payload is not None:
        options = {"data": json.dumps(payload).encode(), "headers": {"Content-Type": "application/json"}}
    with urlopen(Request(BASE + path, **options), timeout=30) as response:
        return response.read().decode()


for attempt in range(30):
    try:
        index = request("/")
        break
    except URLError:
        if attempt == 29:
            raise
        time.sleep(1)

asset = re.search(r'<script[^>]+src="(/assets/[^"]+\.js)"', index)
bundle = request(asset[1]) if asset else ""
assert bundle, "Built frontend script is missing"

# The page is Kubernetes Made Simple, and its lab pages include both guides, which are read when the image is built.
assert "<title>Kubernetes Made Simple</title>" in index, "The page is not Kubernetes Made Simple"
root = Path(__file__).resolve().parent.parent
for guide in ("docs/lab-1-hello-kubernetes.md", "docs/lab-2-your-app-on-eks.md"):
    text = (root / guide).read_text(encoding="utf-8")
    # Command lines with no quotes, backslashes, or dollar signs appear unchanged in the built script.
    commands = [
        line for block in re.findall(r"^```bash\n(.*?)\n```$", text, re.M | re.S)
        for line in block.split("\n") if line.strip() and not re.search(r"[\"'`$\\]", line)
    ]
    assert len(commands) >= 3, f"{guide}: too few plain commands to check"
    missing = [line for line in commands if line not in bundle]
    assert not missing, f"{guide} is missing from the built lab page: {missing[:3]}"
    print(f"{guide}: all {len(commands)} plain commands are in the built lab page")

for version in ("1.35", "1.36", "1.37"):
    for tool in ("prometheus", "argo-cd"):
        config = {"tool": tool, "kubernetesVersion": version, "values": ""}
        rendered = request("/api/render", config)
        assert "kind: Deployment" in rendered, f"Missing deployment for {tool}"
        result = json.loads(request("/api/validate", config))
        assert result["status"] == "passed", f"{tool} / {version}: {result}"
        print(f"{tool} / Kubernetes {version}: rendered and validated")


export = json.loads(request("/api/export", {"tool": "prometheus", "kubernetesVersion": "1.37", "values": ""}))
assert "kind: Namespace" in export["manifests"] and "# Why: Use apps/v1 because" in export["manifests"]


application = """apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
"""
usage = {"tool": "argo-cd", "kubernetesVersion": "1.37", "values": application}
result = json.loads(request("/api/usage/validate", usage))
assert result["status"] == "passed", result
usage["values"] = application.replace("project: default", "project: []")
result = json.loads(request("/api/usage/validate", usage))
assert result["status"] == "error", result
print("Packaged Argo CD usage validation accepts valid resources and rejects invalid fields")

scrape = """scrapeConfigs:
  smoke-test:
    enabled: true
    scrape_interval: 30s
    metrics_path: /metrics
    scheme: http
    static_configs:
      - targets: [metrics.default.svc:8080]
"""
usage = {"tool": "prometheus", "kubernetesVersion": "1.37", "usageTemplate": "scrape-job", "values": scrape}
result = json.loads(request("/api/usage/validate", usage))
assert result["status"] == "passed", result
usage["values"] = scrape.replace("30s", "bad interval")
result = json.loads(request("/api/usage/validate", usage))
assert result["status"] == "error" and result["diagnostics"][0]["check"] == "promtool", result
print("Packaged promtool accepts valid Prometheus usage values and rejects an invalid interval")
