// Run the setup page's practice cluster steps (templates/kubernetes/setup.json) on K3s 1.37.2 with k3d, as a learner whose
// kubeconfig already holds another cluster and no current context. See specs/setup-check.md.
// The test uses its own cluster name and kubeconfig file, so your clusters and ~/.kube/config are untouched.
// Run from the project root with Docker, k3d, and kubectl: node --test tests/practice-cluster.check.mjs
import { deepEqual, equal, fail, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import setup from '../templates/kubernetes/setup.json' with { type: 'json' };
import { defaultLessonValues, lessonContent, lessonText, renderLesson } from '../frontend/src/lesson-builder.ts';

const cluster = 'lkme-practice';
const context = `k3d-${cluster}`;
mkdirSync('.runtime', { recursive: true });
const folder = mkdtempSync(join(process.cwd(), '.runtime', 'practice-'));
const kubeconfig = join(folder, 'kubeconfig');
// Every command in this file, k3d included, reads and writes only this kubeconfig.
process.env.KUBECONFIG = kubeconfig;
// Another cluster's context, as aws eks update-kubeconfig writes it, with the AWS documentation's placeholder account.
const other = 'arn:aws:eks:ap-south-1:111122223333:cluster/class';

function run(command) {
  const result = spawnSync('sh', ['-c', command], { cwd: folder, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout.trim(), output: `${result.stdout}${result.stderr}` };
}

// The setup page's commands, with the test cluster's name in place of practice.
const steps = setup.practiceCluster.steps.map(step => step.commands.replaceAll('practice', cluster).split('\n'));

// Run one step's commands in order. `extra` is added to the last command.
function step(index, extra = '') {
  return steps[index].map((line, number) => {
    const command = `${line}${number === steps[index].length - 1 ? extra : ''}`;
    const result = run(command);
    if (result.status !== 0) fail(`$ ${command}\n${result.output}`);
    return result;
  });
}

// Step 2: kubectl uses the practice cluster, and its node is Ready. A new node can take a few seconds.
function pointsAtPractice() {
  const [current, nodes] = steps[1];
  for (let tries = 0; tries < 40; tries++) {
    if (run(current).stdout === context && new RegExp(`^${context}-server-0\\s+Ready\\s`, 'm').test(run(nodes).stdout)) return;
    spawnSync('sleep', ['3']);
  }
  fail(`kubectl does not point at a Ready ${context}:\n${run(current).output}\n${run(nodes).output}`);
}

after(() => {
  spawnSync('k3d', ['cluster', 'delete', cluster], { stdio: 'ignore' });
  rmSync(folder, { recursive: true, force: true });
});

test('the setup page points kubectl at the practice cluster from a kubeconfig with another cluster and no current context', { timeout: 600000 }, () => {
  ok(spawnSync('k3d', ['cluster', 'get', cluster], { stdio: 'ignore' }).status !== 0, `Delete the leftover test cluster first: k3d cluster delete ${cluster}`);
  deepEqual(steps.map(lines => lines.length), [1, 2, 2, 2]);
  deepEqual(steps[1], ['kubectl config current-context', 'kubectl get nodes']);

  // The learner's kubeconfig before setup, as on the project Mac on 2026-11-27.
  for (const command of [
    `kubectl config set-cluster '${other}' --server=https://192.0.2.10`,
    `kubectl config set-credentials '${other}' --token=dummy-token`,
    `kubectl config set-context '${other}' --cluster='${other}' --user='${other}'`,
  ]) equal(run(command).status, 0, command);
  match(run(steps[1][0]).output, /current-context is not set/);
  // With no current context, kubectl falls back to localhost:8080, the dashboard's port. With the dashboard running, it
  // answers "the server could not find the requested resource". Verbose output shows the address either way.
  match(run('kubectl get nodes --request-timeout=5s -v=6').output, /http:\/\/localhost:8080\/api/);

  // 1. Create the practice cluster, once. The test keeps its API on the loopback address, as the other cluster checks do.
  const [created] = step(0, ' --api-port 127.0.0.1:6564');
  match(created.output, new RegExp(`Cluster '${cluster}' created successfully`));

  // 2. k3d added the cluster to the kubeconfig and switched to it. The other cluster stays.
  pointsAtPractice();
  ok(run('kubectl config get-contexts -o name').stdout.split('\n').includes(other));

  // 3. After another cluster, switch back.
  equal(run(`kubectl config use-context '${other}'`).status, 0);
  const [listed, switched] = step(2);
  match(listed.stdout, new RegExp(`\\s${context}\\s`));
  match(switched.output, new RegExp(`Switched to context "${context}"`));
  pointsAtPractice();

  // 4. The kubeconfig lost the practice cluster while it still runs.
  const user = run(`kubectl config view -o jsonpath='{.contexts[?(@.name=="${context}")].context.user}'`).stdout;
  ok(user, 'the practice context names its user');
  for (const command of [`kubectl config delete-context ${context}`, `kubectl config delete-cluster ${context}`,
    `kubectl config delete-user ${user}`, 'kubectl config unset current-context']) equal(run(command).status, 0, command);
  ok(!run('kubectl config get-contexts -o name').stdout.split('\n').includes(context));
  const [clusters, merged] = step(3);
  match(clusters.stdout, new RegExp(`^${cluster}\\s`, 'm'));
  ok(merged.stdout.endsWith(kubeconfig), `the merge prints the kubeconfig path:\n${merged.output}`);
  pointsAtPractice();

  // The first Try it reaches the practice cluster: the Pod lesson's download runs on its node.
  const pod = lessonContent.pod;
  writeFileSync(join(folder, pod.filename), lessonText(renderLesson(pod, pod.blocks.length - 1, defaultLessonValues(pod), true)));
  match(run(`kubectl apply -f ${pod.filename}`).output, /pod\/web created/);
  equal(run('kubectl wait --for=condition=Ready pod/web --timeout=180s').status, 0);
  equal(run("kubectl get pod web -o jsonpath='{.spec.nodeName}'").stdout, `${context}-server-0`);

  // Deleting the cluster removes its context, and k3d switches kubectl to another cluster in the file, as after Lab 1's
  // last step. That is why step 2 says to check before each Try it.
  equal(run(`k3d cluster delete ${cluster}`).status, 0);
  ok(!run('kubectl config get-contexts -o name').stdout.split('\n').includes(context));
  equal(run(steps[1][0]).stdout, other);
});
