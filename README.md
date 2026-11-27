# Learning Kubernetes made easy - Aviz Academy

[![CI](https://github.com/avizway1/learning-kubernetes-made-easy/actions/workflows/ci.yml/badge.svg)](https://github.com/avizway1/learning-kubernetes-made-easy/actions/workflows/ci.yml)

**Learning Kubernetes made easy** by [Aviz Academy](https://avizacademy.com) teaches Kubernetes one block at a time. Each lesson builds a real file, explains every line in plain English, and gives you commands to try. Lessons are written for Amazon EKS with Auto Mode and Kubernetes 1.35, 1.36, and 1.37. Most of them also run free on a practice cluster on your laptop.

## Start learning

**New to Docker or the terminal?** Use the [start guide](docs/getting-started.html). It goes from a laptop with nothing installed to your first lesson, with copy-paste commands for macOS, Windows, and Linux. Its quick way is one script for your system that installs everything, including Docker and Git. GitHub shows HTML files as code, so save the [raw file](https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/docs/getting-started.html) (right-click, then **Save Link As**) and open it in your browser.

If you already have Docker and Git, run:

```sh
git clone https://github.com/avizway1/learning-kubernetes-made-easy.git
cd learning-kubernetes-made-easy
docker compose up -d
```

Open [localhost:8080](http://localhost:8080), do **Set up your laptop** at the top of the lesson list, then start with **Level 0 · Reading YAML**. Docker downloads the v1.2.0 dashboard image the first time, then starts it in seconds. To stop it, run `docker compose down` from the same folder. To get new lessons later, run `git pull` and `docker compose up -d` again.

The image runs on Linux AMD64 and ARM64, which covers Docker Desktop on Intel and Apple silicon Macs and on Windows. To build it from source instead, see [Contributing](docs/contributing.md#build-the-docker-image-from-source).

## What you'll learn

| Level | Lessons |
| --- | --- |
| 0 · Reading YAML | Read a YAML file, Parts of every manifest |
| 1 · Run an app | Pods, ReplicaSets, Deployments, CPU and memory, Namespaces, ConfigMaps, Secrets, Jobs and CronJobs |
| 2 · Connect apps | ClusterIP, DNS, NodePort, and ExternalName Services. On EKS: LoadBalancer Services and Ingress |
| 3 · Data and special workloads | Headless Services, DaemonSets. On EKS: EBS storage, StatefulSets, and EFS |
| 4 · Run safely | LimitRange, ResourceQuota, probes, start and stop timing, PodDisruptionBudget |
| 5 · Choose where Pods run | Node affinity, Pod anti-affinity, taints. On EKS: Auto Mode NodePools |
| 6 · Release new versions | Rolling update, Recreate, blue-green, canary |
| 7 · Scale | HorizontalPodAutoscaler |
| 8 · AWS access | On EKS: Pod Identity |

Every lesson ends with **Read it** and **Fix it** practice. Lessons marked **Anywhere** run on a free k3d practice cluster. **Set up your laptop**, at the top of the lesson list, says what your laptop needs, installs the tools, points kubectl at the practice cluster, and shows you around inside it. Lessons marked **EKS only** need an EKS Auto Mode cluster in your AWS account, which AWS charges for while it runs.

## Labs

Open each lab from **Hands-on labs** at the bottom of the lesson list. Each one starts with a lesson on its files, then walks you through running it, with a **Copy** button on every command. Do **Set up your laptop**, at the top of the lesson list, first: it checks your tools and unlocks each lab when they are ready. On Windows, every lab command runs in Ubuntu on WSL 2.

| Lab | What you do | Cost |
| --- | --- | --- |
| [Lab 1 · Hello Kubernetes](docs/lab-1-hello-kubernetes.md) | Deploy an app on your laptop, open it in your browser, scale it, and watch Kubernetes replace a deleted Pod. About 15 minutes. | Free |
| [Lab 2 · Your app on EKS](docs/lab-2-your-app-on-eks.md) | Run the same app on EKS Auto Mode, add a load balancer, an EBS disk, and Pod Identity, then delete everything. About 40 minutes. | Uses your AWS account |

## Contributing

[Contributing](docs/contributing.md) covers running from source, the tests, the cluster checks, and the security checks. The [specs](specs/) and the [Decision Log](AGENTS.md#decision-log) record what was built and why. Release notes are in [docs/releases](docs/releases/).

## License

Licensed under the [MIT License](LICENSE). Copyright © 2026 Charan.
