# Lab lessons

**Status: Plan and mock-ups approved by Charan on 2026-11-26**, including whole-object recap steps and lab lesson files in `templates/kubernetes/labs`. Built after [Set up your laptop](setup-check.md).

## Goal

Each lab opens inside the dashboard. Learners first go through a short lesson on the lab's files, then do the lab on their laptop, step by step, with the commands one click away.

## Why

Today the catalogue's **Open guide** leaves the dashboard for a Markdown file on GitHub. The guide shows each file in one long block, so learners apply five objects at once without a walk-through of how they fit together.

## Where it appears

- Each lab card's **Open guide** becomes **Open lab**, which opens `#learn/lab-1` or `#learn/lab-2`.
- The lab page has two parts, shown as tabs: **1 · Understand the files** and **2 · Do it on your laptop**.
- Part 1 is always open. Part 2 is locked until [the setup check](setup-check.md) passes for that lab. The locked panel names the tools still missing and links to the setup page.

## Part 1 · Understand the files

The lesson screen: the card on the left, the file on the right, as lessons are now.

- **One step per object.** Each step highlights one object's lines in the lab file, including the comment above it. Lab 1 has five steps: Namespace, ConfigMap, Secret, Deployment, and Service. Lab 2 has nine: the eksctl ClusterConfig, then IngressClassParams, IngressClass, Ingress, StorageClass, PersistentVolumeClaim, ServiceAccount, ConfigMap, and Deployment.
- **The card** says what the object does in this app and why the lab needs it, and links the lesson that taught it, such as **Learned in: Keep your app running**. The ClusterConfig is not a Kubernetes object and has no lesson, so its card uses the official eksctl docs. Glossary terms show as **Word to remember**.
- **An exception to the block rule.** Lessons add at most six lines a block. A lab step shows a whole object, 55 lines for Lab 1's Deployment, because learners already built each object block by block. The step is a recap.
- **Hover notes** reuse the notes of the lesson each object comes from, matched by kind and field. A unit test lists any field left without a note.
- **Read it** after the last step: three questions per lab file, each with three answers, using the lesson screen's Read it. There is no Fix it, since the lab is the practice.
- **Notes follow the lesson rules:** at most 20 words a sentence and two sentences a section.

### Data

`templates/kubernetes/labs/lab-1.json` and `lab-2.json`, next to the lab files. Each step names a file and an object by kind and name, so the highlighted lines follow the file if it changes. `lessons` starts with the lesson that taught the object, then names lessons for the other parts it uses. `notes` holds hover notes for fields the lessons do not explain, or explain with other values:

```json
{ "file": "hello.yaml", "object": { "kind": "Deployment", "name": "hello" }, "title": "The Deployment runs the web server",
  "what": "...", "why": "...", "lessons": ["deployment", "configmap", "secret", "resources", "probes"], "term": "replica" }
```

Charan approved storing lab lessons in this folder on 2026-11-26, and the folder description in AGENTS.md says so.

## Part 2 · Do it on your laptop

- **One source.** The page reads the lab's Markdown guide in `docs` when the dashboard is built. `tests/lab-guide.check.mjs` keeps testing the same guide, so learners see exactly the commands that were tested.
- **Steps.** Each `##` section becomes a step with a tick box, in guide order, including **What it costs** and **Before you start**. **Before you start** also shows the setup check result and its date.
- **Commands.** Each `bash` block has **Copy**, which copies it exactly. Each YAML block is collapsed under **Show the file**, with **Copy** and **Download**. A unit test already keeps these equal to the lab files.
- **Hidden steps stay hidden.** The guides' `<!-- do: -->` and `<!-- check: -->` comments are for the test and never appear.
- **Links** to other files in this repository open on GitHub, and links to lessons open the lesson in the dashboard.
- **Progress.** Ticks are kept per lab in the browser and survive a reload. **Start again** clears them. If storage is blocked, ticks last for the visit.
- **Rendering.** A small reader turns the Markdown the guides use into page elements: headings, paragraphs, lists, tables, code blocks, links, bold, and inline code. It never inserts HTML. A unit test renders both guides and fails on anything it does not recognise, so a guide change cannot silently disappear from the page.

## Tests

- **Unit:** every lab step names an object that exists in its file, and every object has a step. Read it lines are in range. Notes meet the word rules. The page shows every section, paragraph, command, and file of each guide in order, and nothing from its hidden comments.
- **Browser:** step through every lab step and check the highlighted lines match the object. Part 2 is locked before the setup check and open after it. **Copy** copies the exact command. Ticks survive a reload.
- **Labs:** Lab 1's guide check passes on fresh K3s 1.37.2. Lab 2 runs on EKS again only if its commands change.

## Acceptance criteria

- [x] Each lab opens in the dashboard from its catalogue card.
- [x] **Understand the files** has a step for every object in every lab file, highlights exactly its lines, and links the lesson that taught it.
- [x] Read it works for both labs.
- [x] **Do it on your laptop** shows the whole guide in order, with Copy on every command and tick boxes that survive a reload.
- [x] **Do it on your laptop** is locked until the setup check passes for that lab.
- [x] Unit and browser tests above pass, and Lab 1's guide check passes on fresh K3s.

On 2026-11-26 the unit and browser tests passed, and Lab 1's guide check passed on fresh K3s 1.37.2 in 80 seconds, from cluster creation to deletion. A first run stopped when K3s evicted the Pods because Docker's disk had 2.2 GiB free, below K3s's 3.1 GiB eviction threshold. It passed after Docker's build cache was cleared. The page reads the guides when the dashboard is built, so the Dockerfile copies both guides into the frontend build stage.
