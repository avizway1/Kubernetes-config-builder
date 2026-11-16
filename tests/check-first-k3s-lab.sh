#!/usr/bin/env bash
set -euo pipefail

if [[ ${KCB_LAB_TIMED:-} != 1 ]]; then
  exec python3 - "$0" "$@" <<'PY'
import os
import signal
import subprocess
import sys
import threading
import time

start = time.monotonic()
with subprocess.Popen(['bash', *sys.argv[1:]], env={**os.environ, 'KCB_LAB_TIMED': '1'},
                      stdout=subprocess.PIPE, text=True, start_new_session=True) as process:
    step = 'starting the lab'

    def stop(signum, _frame=None):
        try:
            os.killpg(process.pid, signum)
        except ProcessLookupError:
            pass

    def deadline():
        print(f'Lab exceeded 20 minutes. Last completed step: {step}.', file=sys.stderr, flush=True)
        stop(signal.SIGTERM)

    def cleanup_deadline():
        if process.poll() is None:
            print('Lab cleanup exceeded its 30-second grace period.', file=sys.stderr, flush=True)
            stop(signal.SIGKILL)

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, stop)
    timer = threading.Timer(1200, deadline)
    guard = threading.Timer(1230, cleanup_deadline)
    timer.start()
    guard.start()
    try:
        for line in process.stdout:
            if line.startswith('LAB CHECKPOINT: '):
                step = line.removeprefix('LAB CHECKPOINT: ').strip()
                elapsed = round(time.monotonic() - start)
                print(f'{step}: {elapsed}s', flush=True)
            else:
                print(line, end='', flush=True)
    finally:
        timer.cancel()
        guard.cancel()
print(f'Lab command exited with status {process.returncode} after {time.monotonic() - start:.1f}s.', flush=True)
sys.exit(process.returncode)
PY
fi

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
if [[ $# -eq 0 ]]; then
  mode=download
  cluster=kcb-first-lab
  api_port=6445
elif [[ $# -eq 1 && $1 == --applicationset ]]; then
  mode=applicationset
  cluster=kcb-first-lab-appset
  api_port=6446
else
  echo "Usage: $0 [--applicationset]" >&2
  exit 2
fi

scratch=$(mktemp -d)
created=false
forwards=()
checkpoint() { printf 'LAB CHECKPOINT: %s\n' "$1"; }

cleanup() {
  local status=$?
  if (( status != 0 )); then
    for log in "$scratch"/*-forward.log; do
      [[ ! -f "$log" ]] || cat "$log" >&2
    done
    if [[ "$created" == true ]]; then
      kubectl --request-timeout=5s get pods -A -o wide >&2 || true
      kubectl --request-timeout=5s -n argocd get applications -o wide >&2 || true
      kubectl --request-timeout=5s -n argocd get application metrics-lab -o jsonpath='{.status.conditions}' >&2 || true
      kubectl --request-timeout=5s -n argocd get events --sort-by=.lastTimestamp >&2 || true
      kubectl --request-timeout=5s -n argocd logs deployment/argo-cd-argocd-server --previous --tail=30 >&2 || true
      kubectl --request-timeout=5s -n argocd logs deployment/argo-cd-argocd-repo-server --tail=20 >&2 || true
    fi
  fi
  for pid in "${forwards[@]+${forwards[@]}}"; do kill "$pid" 2>/dev/null || true; done
  if [[ "$created" == true ]]; then k3d cluster delete "$cluster"; fi
  rm -rf "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for binary in docker k3d kubectl helm node python3 curl unzip; do command -v "$binary" >/dev/null; done
if k3d cluster list -o json | python3 -c 'import json,sys; sys.exit(not any(item["name"] == sys.argv[1] for item in json.load(sys.stdin) or []))' "$cluster"; then
  echo "Cluster $cluster already exists. Leave it intact and run this only once at a time." >&2
  exit 2
fi
app_url=${KCB_APP_URL:-http://127.0.0.1:8080}
curl --fail --silent --show-error --max-time 5 "$app_url" >/dev/null
if docker image inspect rancher/k3s:v1.37.2-k3s1 >/dev/null 2>&1; then
  echo 'K3s node image cached on the Docker host. Workload images start uncached inside the new K3s node.'
else
  echo 'K3s node image and cluster workload images start uncached.'
fi
echo "Host: $(uname -s) $(uname -m), app: $app_url"
k3d cluster create "$cluster" --image rancher/k3s:v1.37.2-k3s1 --api-port "127.0.0.1:$api_port" \
  --kubeconfig-update-default=false --kubeconfig-switch-context=false \
  --k3s-arg '--disable=traefik@server:0' --k3s-arg '--disable=metrics-server@server:0' --wait --timeout 4m
created=true
k3d kubeconfig get "$cluster" > "$scratch/kubeconfig.yaml"
export KUBECONFIG="$scratch/kubeconfig.yaml"
[[ $(kubectl config current-context) == "k3d-$cluster" ]]
kubectl get --raw /readyz >/dev/null
checkpoint 'Fresh K3s ready'

node tests/first-k3s-lab.browser.mjs "$mode" "$scratch"
checkpoint 'Browser downloads ready'
unzip -q "$scratch/argo-cd-helm-bundle.zip" -d "$scratch/argo-cd"
argo_bundle="$scratch/argo-cd"
helm install argo-cd "$argo_bundle/argo-cd-10.17.1.tgz" --namespace argocd --create-namespace \
  --values "$argo_bundle/argo-cd-values.yaml" --hide-notes --wait --timeout 5m
checkpoint 'Argo CD ready'

if [[ "$mode" == applicationset ]]; then
  kubectl -n argocd rollout status deployment/argo-cd-argocd-applicationset-controller --timeout=90s
  kubectl apply --server-side --dry-run=server -f "$scratch/application-set.yaml"
  kubectl apply -f "$scratch/application-set.yaml"
  for environment in dev staging; do
    name="metrics-lab-envs-$environment"
    for attempt in {1..45}; do
      namespace=$(kubectl -n argocd get "application/$name" -o jsonpath='{.spec.destination.namespace}' 2>/dev/null || true)
      [[ "$namespace" != "metrics-lab-$environment" ]] || break
      sleep 2
    done
    [[ "$namespace" == "metrics-lab-$environment" ]]
  done
  checkpoint 'Full preset generated Applications for dev and staging'
  exit
fi

unzip -q "$scratch/prometheus-helm-bundle.zip" -d "$scratch/prometheus"
prometheus_bundle="$scratch/prometheus"
helm install prometheus "$prometheus_bundle/prometheus-29.45.1.tgz" --namespace monitoring --create-namespace \
  --values "$prometheus_bundle/prometheus-values.yaml" \
  --set server.persistentVolume.enabled=false,server.global.evaluation_interval=5s --wait --timeout 5m
checkpoint 'Monitoring Prometheus ready'

for id in app-project application; do
  kubectl apply --server-side --dry-run=server -f "$scratch/$id.yaml"
  kubectl apply -f "$scratch/$id.yaml"
  if [[ "$id" == app-project ]]; then kubectl create namespace metrics-lab; fi
done
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.sync.status}'=OutOfSync --timeout=120s
checkpoint 'Argo CD found the sample in Git and is ready to sync'
kubectl -n argocd rollout status deployment/argo-cd-argocd-server --timeout=90s

# The exported guide and the documented command use this same local port.
readme="$argo_bundle/README.txt"
guide='kubectl port-forward svc/argo-cd-argocd-server -n argocd 8081:443'
grep -Fxq "$guide" "$readme"
kubectl port-forward svc/argo-cd-argocd-server -n argocd 8081:443 > "$scratch/argo-forward.log" 2>&1 &
forwards+=("$!")
for attempt in {1..30}; do
  if curl --insecure --fail --silent --max-time 3 https://localhost:8081 >/dev/null; then break; fi
  sleep 1
done
curl --insecure --fail --silent --show-error --max-time 5 https://localhost:8081 >/dev/null
curl --fail --silent --show-error --max-time 5 "$app_url" >/dev/null
checkpoint 'Dashboard and Argo CD 8081 both responding'

kubectl -n argocd patch application metrics-lab --type=merge \
  -p '{"operation":{"sync":{"syncStrategy":{"hook":{}}}}}'
checkpoint 'Sync requested with kubectl'
for attempt in {1..60}; do
  phase=$(kubectl --request-timeout=5s -n argocd get application metrics-lab -o jsonpath='{.status.operationState.phase}')
  case "$phase" in
    Succeeded) break ;;
    Failed|Error)
      kubectl --request-timeout=5s -n argocd get application metrics-lab -o jsonpath='{.status.operationState.message}{"\n"}' >&2
      exit 1 ;;
  esac
  sleep 2
done
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.sync.status}'=Synced --timeout=180s
kubectl -n argocd wait application/metrics-lab --for=jsonpath='{.status.health.status}'=Healthy --timeout=180s
kubectl -n metrics-lab rollout status deployment/sample-app --timeout=90s
checkpoint 'Application is Synced and Healthy'

kubectl apply --server-side --dry-run=server -f "$scratch/service-scrape.yaml"
kubectl apply -f "$scratch/service-scrape.yaml"
kubectl -n metrics-lab wait endpointslice -l kubernetes.io/service-name=sample-app-metrics \
  --for=create --timeout=60s
kubectl -n metrics-lab wait endpointslice -l kubernetes.io/service-name=sample-app-metrics \
  --for=jsonpath='{.endpoints[0].conditions.ready}'=true --timeout=60s
kubectl -n metrics-lab get endpointslice -l kubernetes.io/service-name=sample-app-metrics -o json | python3 -c '
import json,sys
assert any(endpoint["conditions"].get("ready") is True for item in json.load(sys.stdin)["items"] for endpoint in item["endpoints"]), "Generated Service has no ready endpoints"
'

kubectl -n monitoring port-forward svc/prometheus-server 9090:80 > "$scratch/prometheus-forward.log" 2>&1 &
forwards+=("$!")
check_prometheus() {
  python3 - "$1" <<'PY'
import json
import sys
import time
from urllib import request

phase = sys.argv[1]
end = time.monotonic() + 150
last_error = None

def api(path):
    with request.urlopen(f'http://127.0.0.1:9090/api/v1/{path}', timeout=5) as response:
        return json.load(response)['data']

while time.monotonic() < end:
    try:
        targets = api('targets')['activeTargets']
        annotated = [t for t in targets if t['labels'].get('job') == 'kubernetes-service-endpoints'
                     and t['discoveredLabels'].get('__meta_kubernetes_service_name') == 'sample-app-metrics'
                     and t['discoveredLabels'].get('__meta_kubernetes_namespace') == 'metrics-lab']
        custom = [t for t in targets if t['labels'].get('job') == 'sample-app-static']
        rule = next((rule for group in api('rules')['groups'] for rule in group['rules']
                     if rule['name'] == 'SampleAppDown'), None)
        annotation_up = any(t['health'] == 'up' for t in annotated)
        custom_up = any(t['health'] == 'up' for t in custom)
        custom_down = any(t['health'] == 'down' for t in custom)
        state = rule['state'] if rule else None
        if annotation_up and (phase == 'annotated'
                              or phase == 'static' and custom_up
                              or phase in ('loaded', 'recovered') and custom_up and state == 'inactive'
                              or phase == 'firing' and custom_down and state == 'firing'):
            break
        last_error = f'annotated up={annotation_up}, custom up={custom_up}, custom down={custom_down}, rule={state}'
    except (OSError, KeyError, ValueError) as error:
        last_error = str(error)
    time.sleep(2)
else:
    sys.exit(f'Prometheus {phase} timed out: {last_error}')
PY
}

check_prometheus annotated
checkpoint 'Annotated Service target UP'
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
upgrade=(helm upgrade prometheus prometheus-community/prometheus --namespace monitoring --version 29.45.1 --reuse-values)
scrape_values=prometheus-scrape-job-values.yaml
alert_values=prometheus-alert-rule-values.yaml
"${upgrade[@]}" --values "$scratch/$scrape_values"
check_prometheus static
checkpoint 'Static job target UP'
"${upgrade[@]}" --values "$scratch/$alert_values"
check_prometheus loaded
checkpoint 'Alert rule loaded and inactive'
"${upgrade[@]}" --values "$scratch/broken/$scrape_values"
check_prometheus firing
checkpoint 'Static job DOWN and alert firing'
"${upgrade[@]}" --values "$scratch/$scrape_values"
check_prometheus recovered
checkpoint 'Lab complete: target UP and alert inactive after recovery'
