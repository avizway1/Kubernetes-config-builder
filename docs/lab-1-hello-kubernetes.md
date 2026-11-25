# Lab 1 · Hello Kubernetes

Run a small web app on a free Kubernetes cluster on your laptop. You'll open it in your browser, scale it, change its message, and watch Kubernetes replace a Pod you delete. The lab takes about 15 minutes and costs nothing.

The app uses the five objects from Level 1 in one file: a Namespace, a ConfigMap, a Secret, a Deployment, and a Service. Finish Level 1 first, or come back to its lessons when a step mentions an object you haven't met yet.

## Before you start

You need Docker running, plus `k3d` and `kubectl`. The start guide installs all three on macOS, Windows, and Linux. The [README](../README.md#learn-kubernetes) says how to open it. On Windows, run every command in your WSL 2 terminal.

Check the tools:

```bash
docker info --format '{{.ServerVersion}}'
k3d version
kubectl version --client
```

Each command prints a version. If `docker info` prints an error, start Docker Desktop and try again.

## 1. Create a cluster

```bash
k3d cluster create lab-1 --image rancher/k3s:v1.37.2-k3s1 --wait
kubectl get nodes
```

You should see one node, `k3d-lab-1-server-0`, with STATUS `Ready`. k3d also points `kubectl` at the new cluster.

## 2. Save the app file

Download [`hello.yaml`](https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/templates/kubernetes/labs/hello.yaml) into a new folder:

```bash
mkdir -p ~/lab-1 && cd ~/lab-1
curl -fsSLO https://raw.githubusercontent.com/avizway1/Kubernetes-config-builder/main/templates/kubernetes/labs/hello.yaml
```

Or copy this text into a file named `hello.yaml`:

```yaml
# Lab 1 · Hello Kubernetes. One file with the five objects from Level 1.
# A Namespace keeps the lab's objects together, so one delete removes them all.
apiVersion: v1
kind: Namespace
metadata:
  name: hello
---
# The ConfigMap holds the page message and the web server's settings.
apiVersion: v1
kind: ConfigMap
metadata:
  name: hello-page
  namespace: hello
data:
  MESSAGE: "Hello Kubernetes"
  default.conf.template: |
    server {
        listen 8080;
        location = /healthz {
            auth_basic off;
            return 200 "ok\n";
        }
        location / {
            auth_basic "Hello Kubernetes";
            auth_basic_user_file /etc/nginx/login/htpasswd;
            try_files /no-file @page;
        }
        location @page {
            default_type text/html;
            return 200 "<h1>${MESSAGE}</h1><p>Served by Pod $hostname</p>\n";
        }
    }
---
# The Secret holds the login. Sign in as learner with the password kubernetes.
apiVersion: v1
kind: Secret
metadata:
  name: hello-login
  namespace: hello
type: Opaque
stringData:
  htpasswd: "learner:$apr1$kcblab01$CQu3e0qDUa52ZSkHt8tv9/"
---
# The Deployment keeps two copies of the web server running.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello
  namespace: hello
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: web
          image: nginxinc/nginx-unprivileged:1.30.4@sha256:a5866218f05961c7651a4a4a18d9bd0e5e5b4b26aafffb334df3423948db3560
          ports:
            - containerPort: 8080
          env:
            - name: MESSAGE
              valueFrom:
                configMapKeyRef:
                  name: hello-page
                  key: MESSAGE
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
            limits:
              memory: 64Mi
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
          volumeMounts:
            - name: settings
              mountPath: /etc/nginx/templates
            - name: login
              mountPath: /etc/nginx/login
              readOnly: true
      volumes:
        - name: settings
          configMap:
            name: hello-page
            items:
              - key: default.conf.template
                path: default.conf.template
        - name: login
          secret:
            secretName: hello-login
---
# The Service gives the Pods one stable name and port inside the cluster.
apiVersion: v1
kind: Service
metadata:
  name: hello
  namespace: hello
spec:
  selector:
    app: hello
  ports:
    - port: 80
      targetPort: 8080
```

What each object does:

| Object | Its job in this app |
| --- | --- |
| Namespace `hello` | Keeps the lab's objects together. |
| ConfigMap `hello-page` | Holds the page message and the web server settings. The Pod reads `MESSAGE` as an environment variable and the settings as a file. |
| Secret `hello-login` | Holds the login file. The web server asks for it before showing the page. |
| Deployment `hello` | Keeps two Pods running the [NGINX](https://github.com/nginx/docker-nginx-unprivileged) web server. The image runs as a normal user, not root, and is pinned by digest so it never changes under you. |
| Service `hello` | Gives the two Pods one name and port, and shares requests between them. |

The page shows the name of the Pod that answered. You'll use that to see Kubernetes at work.

## 3. Deploy the app

```bash
kubectl apply -f hello.yaml
kubectl rollout status deployment/hello -n hello
kubectl get pods -n hello
```

`kubectl apply` prints one line per object, ending in `created`. When the rollout finishes, you see two Pods named `hello-` and some random letters, each with STATUS `Running` and READY `1/1`.

<!-- check: kubectl get pods -n hello --no-headers | grep -c '1/1 *Running' | grep -qx 2 -->

## 4. Open the app in your browser

Your laptop can't reach the cluster's network directly. `kubectl port-forward` opens a tunnel from a port on your laptop to the Service:

```bash
kubectl port-forward -n hello service/hello 8090:80
```

Leave it running and open [localhost:8090](http://localhost:8090). Sign in as `learner` with the password `kubernetes`. You should see **Hello Kubernetes** and the Pod that served the page.

<!-- check: curl -s -o /dev/null -w '%{http_code}' http://localhost:8090/ | grep -qx 401 -->
<!-- check: curl -fsS -u learner:kubernetes http://localhost:8090/ | grep -q '<h1>Hello Kubernetes</h1><p>Served by Pod hello-' -->

The tunnel always reaches the same Pod, so refreshing shows the same name. Inside the cluster, the Service shares requests between Pods.

Open a second terminal for the next steps, and `cd ~/lab-1` in it. Keep the tunnel running in the first.

## 5. Scale to three Pods

Open `hello.yaml` in a text editor. Change `replicas: 2` to `replicas: 3` and save. Then apply the file again:

<!-- do: sed -i.bak 's/replicas: 2/replicas: 3/' hello.yaml -->

```bash
kubectl apply -f hello.yaml
kubectl get pods -n hello
```

The Deployment says `configured`, because its replicas changed. A third Pod appears and is `Running` within a few seconds.

<!-- check: kubectl rollout status deployment/hello -n hello --timeout=180s -->
<!-- check: kubectl get pods -n hello --no-headers | grep -c '1/1 *Running' | grep -qx 3 -->

You changed the file, not the Pods. Kubernetes compared what you asked for with what was running and added one Pod to match.

## 6. Delete a Pod and watch it come back

Delete the first Pod in the list:

```bash
kubectl delete -n hello $(kubectl get pods -n hello -o name | head -n 1)
kubectl get pods -n hello --watch
```

The Pod you deleted shows `Terminating`, and a new Pod with a different name starts. The Deployment wants three, so it replaces the one you removed. Press **Ctrl+C** to stop watching.

<!-- check: kubectl rollout status deployment/hello -n hello --timeout=180s -->
<!-- check: kubectl get pods -n hello --no-headers | grep -c '1/1 *Running' | grep -qx 3 -->

If the deleted Pod was the one behind your tunnel, the first terminal prints `lost connection to pod`. Press **Ctrl+C** there and run the `kubectl port-forward` command again.

## 7. Change the message

Open `hello.yaml` again. Change `MESSAGE: "Hello Kubernetes"` to `MESSAGE: "Hello from my laptop"` and save. Apply it:

<!-- do: sed -i.bak 's/MESSAGE: "Hello Kubernetes"/MESSAGE: "Hello from my laptop"/' hello.yaml -->

```bash
kubectl apply -f hello.yaml
```

<!-- check: curl -fsS -u learner:kubernetes http://localhost:8090/ | grep -q '<h1>Hello Kubernetes</h1>' -->

Refresh the page. It still says **Hello Kubernetes**. A Pod reads its environment variables only when it starts, so the running Pods keep the old message. Restart them:

```bash
kubectl rollout restart deployment/hello -n hello
kubectl rollout status deployment/hello -n hello
```

Kubernetes starts new Pods one at a time and removes the old ones, so the app keeps running. Your tunnel ends because its Pod is gone. Run the `kubectl port-forward` command again in the first terminal and refresh the page. It says **Hello from my laptop**, served by one of the new Pods.

<!-- check: curl -fsS -u learner:kubernetes http://localhost:8090/ | grep -q '<h1>Hello from my laptop</h1>' -->

## 8. Clean up

Stop the tunnel with **Ctrl+C**, then delete the cluster:

```bash
k3d cluster delete lab-1
```

This deletes the cluster and everything in it. Run `k3d cluster list` to check it's gone. If you also use the `practice` cluster, switch back to it with `kubectl config use-context k3d-practice`.

## What you did

- Deployed five objects from one file with `kubectl apply`.
- Reached a Service from your laptop with `kubectl port-forward`.
- Scaled by changing the file, not by touching Pods.
- Watched a Deployment replace a deleted Pod.
- Learned that Pods read ConfigMap values as environment variables only when they start.

Next, [Lab 2 · Your app on EKS](lab-2-your-app-on-eks.md) runs this same file on Amazon EKS.
