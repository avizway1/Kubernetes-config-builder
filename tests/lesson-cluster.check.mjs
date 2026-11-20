// Apply every lesson to a dedicated test cluster and confirm each Try it result with its check.
// Needs kubectl and curl. Run from the project root with KCB_LESSON_KUBECONFIG and KCB_LESSON_VERSION set (1.35, 1.36, or 1.37).
// K3s (the default): tests/check-lessons-k3s.sh creates the cluster, runs this file for the Anywhere lessons, and deletes
// the cluster. KCB_LESSON_NODES is the cluster's node count. Each run checks only the lessons written for that many nodes.
// EKS: tests/check-lessons-eks.sh sets KCB_LESSON_PLATFORM=eks and runs the EKS only lessons against a dedicated
// EKS Auto Mode cluster named kcb-lessons-*, with KCB_EKS_CLUSTER, KCB_EKS_ACCOUNT, and KCB_EFS_ID. It also needs the AWS CLI.
import { equal, fail, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import catalogue from '../templates/kubernetes/lessons.json' with { type: 'json' };
import { brokenFile, defaultLessonValues, lessonContent, lessonText, practiceFile, renderLesson } from '../frontend/src/lesson-builder.ts';

const kubeconfig = process.env.KCB_LESSON_KUBECONFIG;
const version = process.env.KCB_LESSON_VERSION;
const nodes = Number(process.env.KCB_LESSON_NODES ?? 1);
const platform = process.env.KCB_LESSON_PLATFORM ?? 'k3s';
const retrySeconds = Number(process.env.KCB_LESSON_RETRY_SECONDS ?? 180);

function shell(command, cwd) {
  const result = spawnSync('sh', ['-c', command], { cwd, encoding: 'utf8', env: { ...process.env, KUBECONFIG: kubeconfig } });
  return { status: result.status, stdout: result.stdout, output: `${result.stdout}${result.stderr}` };
}

const fill = (text, values) => String(text).replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? '');

function problem(check, result, values) {
  if (result.status !== 0 && !check.anyStatus) return `exit status ${result.status}`;
  for (const text of check.expect ?? []) if (!result.output.includes(fill(text, values))) return `missing "${fill(text, values)}"`;
  if (check.pattern && !new RegExp(fill(check.pattern, values)).test(result.output)) return `no match for /${fill(check.pattern, values)}/`;
  if (check.lines !== undefined) {
    const count = result.stdout.split('\n').filter(line => line.trim()).length;
    if (count !== Number(fill(check.lines, values))) return `${count} lines, expected ${fill(check.lines, values)}`;
  }
  return undefined;
}

// Apply and delete change the cluster, so they run once. Every other command waits for the cluster to catch up.
function confirm(label, command, check, values, cwd, once) {
  const deadline = Date.now() + retrySeconds * 1000;
  for (;;) {
    const result = shell(command, cwd);
    const issue = problem(check, result, values);
    if (!issue) return result;
    if (once || Date.now() > deadline) fail(`${label}: ${issue}\n$ ${command}\n${result.output}`);
    spawnSync('sleep', ['3']);
  }
}

test(`the cluster is a dedicated ${platform === 'eks' ? 'EKS Auto Mode' : 'loopback K3s'} test cluster`, () => {
  ok(kubeconfig && version, 'Set KCB_LESSON_KUBECONFIG and KCB_LESSON_VERSION. Use tests/check-lessons-k3s.sh or tests/check-lessons-eks.sh.');
  if (platform === 'eks') {
    const { KCB_EKS_CLUSTER: cluster, KCB_EKS_ACCOUNT: account, KCB_EFS_ID: efs } = process.env;
    match(cluster ?? '', /^kcb-lessons-[a-z0-9-]+$/, 'KCB_EKS_CLUSTER must name a dedicated kcb-lessons-* cluster');
    match(account ?? '', /^\d{12}$/, 'Set KCB_EKS_ACCOUNT to the 12-digit account ID');
    match(efs ?? '', /^fs-[0-9a-f]+$/, 'Set KCB_EFS_ID to the test file system ID');
    match(shell('kubectl config current-context').stdout.trim(), new RegExp(`^arn:aws:eks:[a-z0-9-]+:${account}:cluster/${cluster}$`));
    match(shell("kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'").stdout, /^https:\/\/[0-9A-F]+\.[a-z0-9]+\.[a-z0-9-]+\.eks\.amazonaws\.com$/);
    const server = JSON.parse(shell('kubectl get --raw /version').stdout).gitVersion;
    ok(server.startsWith(`v${version}.`) && server.includes('-eks-'), `Expected EKS ${version}, got ${server}`);
    return;
  }
  match(shell('kubectl config current-context').stdout.trim(), /^k3d-kcb-lessons-\d+$/);
  match(shell("kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'").stdout, /^https:\/\/127\.0\.0\.1:\d+$/);
  const server = JSON.parse(shell('kubectl get --raw /version').stdout).gitVersion;
  ok(server.startsWith(`v${version}.`) && server.includes('+k3s'), `Expected K3s ${version}, got ${server}`);
  equal(shell('kubectl get nodes -o name').stdout.trim().split('\n').length, nodes, `Expected ${nodes} nodes`);
});

const download = lesson => lessonText(renderLesson(lesson, lesson.blocks.length - 1, defaultLessonValues(lesson), true));
const files = lesson => [lesson, ...(lesson.uses ?? []).map(id => lessonContent[id])].map(used => `-f ${used.filename}`).join(' ');

const runsHere = new Set(catalogue.levels.flatMap(level => level.lessons).filter(lesson => lesson.runsOn === (platform === 'eks' ? 'eks' : 'anywhere')).map(lesson => lesson.id));
// EKS Auto Mode adds nodes as Pods need them, so the node count matters only on K3s.
// KCB_LESSON_ONLY, a comma-separated list of lesson IDs, reruns just those lessons, such as after fixing them.
const only = process.env.KCB_LESSON_ONLY?.split(',');
const checked = Object.values(lessonContent).filter(lesson => lesson.kind && runsHere.has(lesson.id) && (platform === 'eks' || (lesson.nodes ?? 1) === nodes)
  && (!only || only.includes(lesson.id)));
// Commands that change the cluster or AWS run once: kubectl apply or delete, also at the end of a pipe, and AWS CLI create or delete.
const once = command => /(^|\| )kubectl (apply|delete)\b/.test(command) || /^aws \S+ (create|delete)-/.test(command);

for (const lesson of checked) {
  test(`${lesson.id}: every Try it result happens on ${platform === 'eks' ? 'EKS' : 'K3s'} ${version}`, () => {
    const folder = mkdtempSync(join(tmpdir(), `lesson-${lesson.id}-`));
    const values = defaultLessonValues(lesson);
    try {
      // The exact files learners download: the finished lesson, and any earlier lessons it uses, with block explanations.
      for (const used of [...(lesson.uses ?? []).map(id => lessonContent[id]), lesson]) writeFileSync(join(folder, used.filename), download(used));
      try {
        for (const [index, item] of lesson.tryIt.entries()) {
          ok(item.check, `${lesson.id} step ${index + 1} has no check`);
          const label = `${lesson.id} step ${index + 1}`;
          const command = item.check.run ?? item.command;
          confirm(label, command, item.check, values, folder, once(command));
          if (item.check.then) confirm(`${label}, afterwards`, item.check.then.run, item.check.then, values, folder, false);
        }
      } catch (error) {
        // Run the lesson's own delete steps, so a failure leaves nothing behind for the next test or in AWS.
        for (const item of lesson.tryIt) {
          const command = item.check?.run ?? item.command;
          if (/(^|\| )kubectl delete\b|^aws \S+ delete-/.test(command)) shell(command, folder);
        }
        throw error;
      }
      equal(shell(`kubectl get ${files(lesson)} --ignore-not-found -o name`, folder).stdout.trim(), '', `${lesson.id} left objects behind`);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
}

// Fix it shows what Kubernetes says about each broken copy. Apply the copy under the lesson's filename, as learners
// would, then remove whatever it created using the working file.
for (const lesson of checked.filter(lesson => lesson.practice)) {
  test(`${lesson.id}: the Fix it message is what ${platform === 'eks' ? 'EKS' : 'K3s'} ${version} shows`, () => {
    const { fix } = lesson.practice;
    const folder = mkdtempSync(join(tmpdir(), `lesson-fix-${lesson.id}-`));
    const file = join(folder, lesson.filename);
    try {
      // Write every used file, as learners have them. Apply first only those Try it applies before the lesson's own file.
      for (const id of lesson.uses ?? []) {
        const used = lessonContent[id];
        writeFileSync(join(folder, used.filename), download(used));
        if (lesson.tryIt.some(item => item.command === `kubectl apply -f ${used.filename}`)) {
          equal(shell(`kubectl apply -f ${used.filename}`, folder).status, 0, `${lesson.id}: could not apply ${id}`);
        }
      }
      writeFileSync(file, brokenFile(lesson, fix).text);
      const applied = shell(`kubectl apply -f ${lesson.filename}`, folder);
      if (fix.source === 'apply') {
        ok(applied.status !== 0, `${lesson.id}: the broken copy applied without an error\n${applied.output}`);
        ok(applied.output.includes(fix.message), `${lesson.id}: expected\n${fix.message}\ngot\n${applied.output}`);
      } else {
        equal(applied.status, 0, `${lesson.id}: the broken copy should apply\n${applied.output}`);
        // The command may fail on purpose, as wget does for a name that does not exist.
        confirm(`${lesson.id} fix`, fix.command, { pattern: fix.expect, anyStatus: true }, {}, folder, false);
      }
    } finally {
      writeFileSync(file, practiceFile(lesson).text);
      shell(`kubectl delete ${files(lesson)} --ignore-not-found --wait=true`, folder);
      rmSync(folder, { recursive: true, force: true });
    }
  });
}
