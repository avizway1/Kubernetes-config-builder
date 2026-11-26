# Prebuilt Docker releases

Publish a public GHCR image for each stable release on Linux AMD64 and ARM64. Build the release source with the existing verified Dockerfile, including patched promtool and chart and schema checksum checks. Verify both platform builds and publish a release-tagged manifest.

Testers use the release Compose file and `docker compose up -d` with a fresh image cache and no registry credentials. Measure elapsed time from invoking Compose to a successful dashboard HTTP response. Developers can still build locally with an explicit Compose override.

Backfill the already reviewed v0.3.0 release from its existing tag and attach the pull-based Compose file to the release.

## v1.0.0: phase 1 from avizway1

Charan chose on 2026-11-26 to release phase 1, Learn Kubernetes, as **v1.0.0** from [avizway1/Kubernetes-config-builder](https://github.com/avizway1/Kubernetes-config-builder), with the images in Charan's GitHub account. Learners pull the image instead of building it.

**Inputs.** The release commit on `main`, the existing `release-image.yml` workflow, and a GitHub release named `v1.0.0`, created only after Charan confirms the final review.

**Outputs.**

- `release-image.yml` publishes `ghcr.io/avizway1/kubernetes-config-builder:v1.0.0` for Linux AMD64 and ARM64. The workflow already names the image after the repository, so it needs no change. New GHCR packages start private, so Charan sets the package to public in its GitHub settings when the first build job finishes, and the failed anonymous start jobs are rerun.
- `compose.yaml` pulls `ghcr.io/avizway1/kubernetes-config-builder:v1.0.0` by default. `compose.build.yaml` stays for building from source.
- The README and the [start guide](../docs/getting-started.html) start the dashboard with `git clone` and `docker compose up -d`, and use plain `docker compose` for the everyday commands. Building from source moves to [Contributing](../docs/contributing.md), with its 8 GB memory note.
- The start guide asks for a laptop with 8 GB of memory and at least 4 GB for Docker, instead of 16 GB and 8 GB. On 2026-11-26, the pulled dashboard plus a three-node k3d practice cluster (K3s 1.37.2) running Lab 1's app scaled to three Pods raised the Docker VM's used memory by about 1.1 GiB, from 767 MiB to a peak of 1,852 MiB that includes two unrelated containers. Docker Desktop's [memory limit](https://docs.docker.com/desktop/settings-and-maintenance/settings/) and WSL 2's [memory setting](https://learn.microsoft.com/windows/wsl/wsl-config) both default to half the laptop's memory.
- `tests/check-docker-release.py` also checks that the image serves Learn Kubernetes, with the lab guides built in.
- Release notes in [docs/releases/v1.0.0.md](../docs/releases/v1.0.0.md). The release workflow attaches the pull-based `compose.yaml` to the release.

**Acceptance criteria**

- [ ] CI passes on the release commit, including the Docker package check.
- [ ] Charan confirms the final review before the `v1.0.0` release and tag are created.
- [ ] The release workflow publishes `v1.0.0` for Linux AMD64 and ARM64 under `ghcr.io/avizway1`, and the anonymous cold start passes on both.
- [ ] On the project Mac, with no dashboard image cached, the start guide's commands pull the image and open Learn Kubernetes. Record the time from `docker compose up -d` to the first page.
- [ ] The `v1.0.0` release has the verified `compose.yaml` attached.
