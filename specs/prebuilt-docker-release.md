# Prebuilt Docker releases

Publish a public GHCR image for each stable release on Linux AMD64 and ARM64. Build the release source with the project Dockerfile, verify both platform builds, and publish a release-tagged manifest.

Learners use the release Compose file and `docker compose up -d` with a fresh image cache and no registry credentials. Measure elapsed time from invoking Compose to a successful dashboard HTTP response. Developers can still build locally with an explicit Compose override.

## v1.0.0: the first release of the lessons and labs

Charan chose on 2026-11-26 to release Learn Kubernetes as **v1.0.0** from this repository, with the images in Charan's GitHub account. Learners pull the image instead of building it.

**Inputs.** The release commit on `main`, the existing `release-image.yml` workflow, and a GitHub release named `v1.0.0`, created only after Charan confirms the final review.

**Outputs.**

- `release-image.yml` publishes the image under `ghcr.io/avizway1` for Linux AMD64 and ARM64. The workflow names the image after the repository. The package was public from its first push, so no GitHub setting had to change.
- `compose.yaml` pulls the v1.0.0 image by default. `compose.build.yaml` stays for building from source.
- The README and the [start guide](../docs/getting-started.html) start the dashboard with `git clone` and `docker compose up -d`, and use plain `docker compose` for the everyday commands. Building from source moves to [Contributing](../docs/contributing.md).
- The start guide asks for a laptop with 8 GB of memory and at least 4 GB for Docker, instead of 16 GB and 8 GB. On 2026-11-26, the pulled dashboard plus a three-node k3d practice cluster (K3s 1.37.2) running Lab 1's app scaled to three Pods raised the Docker VM's used memory by about 1.1 GiB, from 767 MiB to a peak of 1,852 MiB that includes two unrelated containers. Docker Desktop's [memory limit](https://docs.docker.com/desktop/settings-and-maintenance/settings/) and WSL 2's [memory setting](https://learn.microsoft.com/windows/wsl/wsl-config) both default to half the laptop's memory.
- `tests/check-docker-release.py` checks that the image serves Learn Kubernetes, with the lab guides built in.
- Release notes in [docs/releases/v1.0.0.md](../docs/releases/v1.0.0.md). The release workflow attaches the pull-based `compose.yaml` to the release.

**Acceptance criteria**

- [x] CI passes on the release commit, including the Docker package check.
- [x] Charan confirms the final review before the `v1.0.0` release and tag are created.
- [x] The release workflow publishes `v1.0.0` for Linux AMD64 and ARM64 under `ghcr.io/avizway1`, and the anonymous cold start passes on both.
- [x] On the project Mac, with no dashboard image cached, the start guide's commands pull the image and open Learn Kubernetes. Record the time from `docker compose up -d` to the first page.
- [x] The `v1.0.0` release has the verified `compose.yaml` attached.

**Results, 2026-11-26.** Charan confirmed the final review, and [v1.0.0](https://github.com/avizway1/learning-kubernetes-made-easy/releases/tag/v1.0.0) was released from `12fb127`. CI passed on that commit on the branch, and on `main` after a rerun: the first `main` run stopped when GitHub answered the pinned Trivy download with HTTP 403, and the rerun passed every job. The release workflow built, tested, and scanned both architectures, published the multi-architecture tag, and attached `compose.yaml`. Its anonymous cold starts took 7.16 seconds on AMD64 and 7.55 seconds on ARM64. On the project Mac (Apple silicon, Docker Desktop), a fresh `git clone` took 1.2 seconds, and `docker compose up -d` reached the first page in 13.6 seconds with no cached image and no registry credentials. The page opened on Learn Kubernetes, `tests/check-docker-release.py` passed against it, and `docker compose down --rmi all` removed the image. That command also removes any image built from source in a folder with the same name, because Compose labels built images with the folder's project name.

## v1.1.0: Learning Kubernetes made easy

On 2026-11-26 Charan renamed the project **Learning Kubernetes made easy - Aviz Academy** and limited this repository to the lessons, labs, setup check, and start guide. The repository is now [avizway1/learning-kubernetes-made-easy](https://github.com/avizway1/learning-kubernetes-made-easy).

**Inputs.** The release commit on `main`, `release-image.yml`, and a GitHub release named `v1.1.0`, created only after Charan confirms the final review.

**Outputs.**

- The page title is **Learning Kubernetes made easy - Aviz Academy**, and the header shows **Learning Kubernetes made easy** beside the Aviz Academy logo.
- `release-image.yml` publishes `ghcr.io/avizway1/learning-kubernetes-made-easy:v1.1.0` for Linux AMD64 and ARM64, named after the renamed repository. A new package may start private. If the anonymous start jobs fail for that reason, Charan sets the package to public in its GitHub package settings and reruns the failed jobs.
- `compose.yaml` pulls `ghcr.io/avizway1/learning-kubernetes-made-easy:v1.1.0` by default. `compose.build.yaml` builds `learning-kubernetes-made-easy:local`.
- The image holds the built dashboard and a small Go server that serves it on port 8080. It needs no other tools, so it is about 23 MB, and a build from source needs no extra Docker memory.
- `tests/check-docker-release.py` checks the page title, the lab guides in the built page, and the cache headers: `no-cache` for the page, one year for hashed files.
- The dashboard stores the setup check and lab ticks under new browser storage names, so each learner's saved check and ticks reset once. The release notes say so.
- Release notes in [docs/releases/v1.1.0.md](../docs/releases/v1.1.0.md).

**Acceptance criteria**

- [ ] CI passes on the release commit, including the Docker package check and the WSL 2 setup check.
- [ ] Charan confirms the final review before the `v1.1.0` release and tag are created.
- [ ] The release workflow publishes `v1.1.0` for Linux AMD64 and ARM64 at `ghcr.io/avizway1/learning-kubernetes-made-easy`, and the anonymous cold start passes on both.
- [ ] On the project Mac, with no dashboard image cached, the start guide's commands pull the image and open Learn Kubernetes.
- [ ] The `v1.1.0` release has the verified `compose.yaml` attached.
