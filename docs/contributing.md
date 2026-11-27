# Contributing

How to run Learning Kubernetes made easy from source, and how to run its tests and checks. Read [AGENTS.md](../AGENTS.md) first: it holds the project rules, the Lessons Learned, and the Decision Log. Every feature starts as a spec in [specs](../specs/).

## Run from source

Install Node.js 26.13.1, kubeconform, and Python 3. If you use nvm, run `nvm install` and `nvm use` from the project root. Prepare the pinned schemas once:

```sh
python3 backend/download-schemas.py
```

Start the dashboard from the project root:

```sh
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) or the URL printed by Vite. Lessons, labs, and the setup page all run in the browser, so the dev server is all you need.

The Docker image serves the built pages with a small Go server in `backend`. To run it the same way without Docker, install Go 1.27.4, run `npm run build` in `frontend`, then run `go run .` in `backend` and open [http://localhost:8080](http://localhost:8080).

## Build the Docker image from source

The README starts the published image. To build the same image from your checkout instead, run this from the project root:

```sh
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

The 4 GB of Docker memory that the start guide asks for is enough. The first build also downloads the Node.js and Go base images. After that, a build without cache took 17 seconds on the project Mac. Stop it with `docker compose -f compose.yaml -f compose.build.yaml down`. The same build runs in CI's package job.

## Lessons and labs

Lessons live in `templates/kubernetes/lessons`, one JSON file per lesson, listed in `templates/kubernetes/lessons.json`. Each file holds the whole YAML after every block, the notes, Try it commands with the results to check, and Read it and Fix it practice. The [beginner learning path](../specs/beginner-learning-path.md) sets the writing rules.

Lab guides are Markdown files in `docs`, and their YAML files are in `templates/kubernetes/labs`. The guide is also the test: `tests/lab-guide.check.mjs` runs every command in its `bash` blocks in order, plus hidden `<!-- do: ... -->` and `<!-- check: ... -->` steps. A unit test checks that every YAML block in a guide matches a lab file. The dashboard's lab pages read the same guides when the dashboard is built, so a guide change appears there after a rebuild. `tests/lab-lessons.test.mjs` fails if a guide uses Markdown the lab page cannot show, or if the page would drop any of its text. Each lab's **Understand the files** steps are in `templates/kubernetes/labs/lab-1.json` and `lab-2.json`.

## Test

Run these from `frontend`:

- `npm run lint`, `npm test`, and `npm run build`.

Run these from the project root:

- `go test ./...` from `backend`, to check the server's caching headers.
- `node --test tests/lesson-manifests.check.mjs`, after preparing the schemas, to check every finished lesson step and every lab file with strict kubeconform.
- `tests/check-lessons-k3s.sh 1.37`, with Docker, k3d, kubectl, and curl installed, to apply every Anywhere lesson to a fresh K3s cluster. It checks each **Try it** result and each **Fix it** message, then deletes the cluster. Repeat with `1.36` and `1.35`.
- `LKME_LAB_LIMIT_SECONDS=900 node tests/lab-guide.check.mjs docs/lab-1-hello-kubernetes.md` to run Lab 1 on a fresh K3s cluster and time it. It uses its own kubeconfig in `.runtime`, so yours is untouched.
- `node --test tests/practice-cluster.check.mjs` to run the setup page's practice cluster and kubeconfig steps on K3s 1.37.2. It starts from a kubeconfig that holds another cluster and no current context, applies the Pod lesson's file, then deletes its `lkme-practice` cluster. It uses its own kubeconfig in `.runtime`, so yours is untouched.

### Browser checks

Run the browser checks with the Vite dev server running. From `frontend`, install Chromium with `npx playwright-core install chromium`, then run `npm run test:browser`. Set `LKME_CHROME_PATH` to use an installed Chrome binary, and `LKME_APP_URL` if the dev server is not at `http://127.0.0.1:5173`.

### Checks on EKS

These create resources in AWS, which charges for them. Run them only with Charan's approval of the account, Region, and budget, and delete everything afterwards.

EKS only lessons, on a dedicated cluster named `lkme-lessons-*`:

```sh
export LKME_EKS_CLUSTER=lkme-lessons-137 LKME_EKS_REGION=ap-south-1
LKME_EFS_ID=$(tests/eks-lessons-cluster.sh create 1.37 | tail -n 1)
LKME_EFS_ID=$LKME_EFS_ID tests/check-lessons-eks.sh 1.37
tests/eks-lessons-cluster.sh delete
```

Creating the cluster and EFS takes about 20 minutes. The check waits up to ten minutes for each load balancer, volume, or new machine. `delete` removes the lessons' objects first, so AWS removes their load balancers and volumes, then the EFS file system, the roles, and the cluster. It ends by listing anything left. Set `LKME_LESSON_ONLY=<id>,<id>` to rerun some lessons. The check also saves the cluster's NodePool and IngressClassParams CRDs in `.runtime/eks-crds`. Compare them with `backend/eks-crds` to see whether Auto Mode changed either kind.

Lab 2 creates and deletes its own cluster, `hello-eks`, as a learner would:

```sh
LKME_LAB_SET='{"export AWS_REGION=us-east-1":"export AWS_REGION=ap-south-1"}' LKME_LAB_RETRY_SECONDS=600 LKME_LAB_LIMIT_SECONDS=2400 \
  node tests/lab-guide.check.mjs docs/lab-2-your-app-on-eks.md
```

If a step fails, the check runs the guide's clean-up commands. Check the AWS console afterwards anyway.

### CI

GitHub Actions runs on every push. It tests and builds the frontend, checks every lesson step and lab file with strict kubeconform, tests the Go server, runs the browser checks, builds and checks the Docker image, and runs the setup page's Windows commands in Ubuntu on WSL 2.

## Security checks

CI fails on high or critical npm and Go findings, and on high or critical findings in the built Docker image. The only exception is an unfixed development-only npm finding recorded in the [accepted dependency risks file](../security/accepted-dependency-risks.json). It fails again after its review date, if it reaches the runtime dependencies, or once a fixed release is published. npm audit reads the frontend lockfile, and Trivy scans the Go module and the image.

## Releases

Release notes are in [docs/releases](releases/). Tag a release only after Charan confirms the final review.

1. Write the release notes and point `compose.yaml` at the new version on a branch. Merge it into `main` once CI passes and Charan confirms the final review.
2. Create the GitHub release from that commit, for example `gh release create v1.2.0 --target main --title v1.2.0 --notes-file docs/releases/v1.2.0.md`. Publishing the release starts `release-image.yml`, which builds, tests, and scans both architectures, then publishes `ghcr.io/avizway1/learning-kubernetes-made-easy:<version>`.
3. The workflow's last jobs start the image without credentials on both architectures, then attach the verified `compose.yaml` to the release. If the package is private, those start jobs fail: set it to public in its GitHub package settings, then rerun the failed jobs.
