// Run step 6 of Set up your laptop (templates/kubernetes/setup.json) on K3s 1.37.2 with k3d, as a learner whose kubeconfig
// already holds another cluster and no current context. Cause each message in If something goes wrong, check that it
// matches, run its fix, and check that the every-time commands work again. See specs/setup-check.md.
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

// The setup page's text, with the test cluster's name in place of practice.
const named = text => text.replaceAll('practice', cluster);
const [once, everyTime] = setup.practiceCluster.steps.map(step => named(step.commands).split('\n'));
const problems = setup.practiceCluster.problems.map(problem => ({
  ...problem, message: named(problem.message), commands: problem.commands ? named(problem.commands).split('\n') : [],
}));

// Run commands in order and stop at the first failure. The test keeps its cluster's API on the loopback address, as the
// other cluster checks do. Every other command is the learner's.
function runAll(commands) {
  return commands.map(line => {
    const command = line.startsWith('k3d cluster create ') ? `${line} --api-port 127.0.0.1:6564` : line;
    const result = run(command);
    if (result.status !== 0) fail(`$ ${command}\n${result.output}`);
    return result;
  });
}

// The every-time commands switch to the practice cluster, and its node is Ready. A started node can take a few seconds.
function practiseAgain() {
  const [switched] = runAll([everyTime[0]]);
  match(switched.output, new RegExp(`Switched to context "${context}"`));
  for (let tries = 0; tries < 40; tries++) {
    if (new RegExp(`^${context}-server-0\\s+Ready\\s`, 'm').test(run(everyTime[1]).stdout)) return;
    spawnSync('sleep', ['3']);
  }
  fail(`${context}-server-0 is not Ready:\n${run(everyTime[1]).output}`);
}

// A message as the setup page shows it. "..." stands for the server address.
const shows = (output, message) => ok(new RegExp(message.split('...').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+'))
  .test(output), `expected "${message}" in:\n${output}`);

after(() => {
  spawnSync('k3d', ['cluster', 'delete', cluster], { stdio: 'ignore' });
  rmSync(folder, { recursive: true, force: true });
});

test('step 6 sets up the practice cluster from scratch, and each message has a fix that works', { timeout: 900000 }, () => {
  ok(spawnSync('k3d', ['cluster', 'get', cluster], { stdio: 'ignore' }).status !== 0, `Delete the leftover test cluster first: k3d cluster delete ${cluster}`);
  deepEqual(once.length, 3);
  deepEqual(everyTime, ['kubectl config use-context k3d-lkme-practice', 'kubectl get nodes']);
  equal(problems.length, 4);

  // The learner's kubeconfig before setup, as on the project Mac on 2026-11-27: another cluster and no current context.
  for (const command of [
    `kubectl config set-cluster '${other}' --server=https://192.0.2.10`,
    `kubectl config set-credentials '${other}' --token=dummy-token`,
    `kubectl config set-context '${other}' --cluster='${other}' --user='${other}'`,
  ]) equal(run(command).status, 0, command);
  match(run('kubectl config current-context').output, /current-context is not set/);
  // With no current context, kubectl falls back to localhost:8080, the dashboard's port. With the dashboard running it
  // answers "the server could not find the requested resource". Verbose output shows the address either way.
  match(run('kubectl get nodes --request-timeout=5s -v=6').output, /http:\/\/localhost:8080\/api/);

  // Before the cluster exists, the every-time commands give the first message.
  shows(run(everyTime[0]).output, problems[0].message);

  // Do this once: create the cluster, point kubectl at it, and list its node.
  const [created, switched, nodes] = runAll(once);
  shows(created.output, `Cluster '${cluster}' created successfully`);
  shows(switched.output, `Switched to context "${context}"`);
  match(nodes.stdout, new RegExp(`^${context}-server-0\\s+Ready\\s`, 'm'));
  ok(run('kubectl config get-contexts -o name').stdout.split('\n').includes(other), 'the other cluster stays');

  // Every time: after another cluster, the two lines switch back.
  equal(run(`kubectl config use-context '${other}'`).status, 0);
  practiseAgain();

  // Creating it again gives the last message, and the every-time commands still work.
  shows(run(`${once[0]} --api-port 127.0.0.1:6564`).output, problems[3].message);
  equal(problems[3].commands.length, 0);
  practiseAgain();

  // The kubeconfig lost the practice cluster while it still runs: the first message, then its fix.
  const user = run(`kubectl config view -o jsonpath='{.contexts[?(@.name=="${context}")].context.user}'`).stdout;
  ok(user, 'the practice context names its user');
  for (const command of [`kubectl config delete-context ${context}`, `kubectl config delete-cluster ${context}`,
    `kubectl config delete-user ${user}`]) equal(run(command).status, 0, command);
  shows(run(everyTime[0]).output, problems[0].message);
  const [listed, merged] = runAll(problems[0].commands);
  match(listed.stdout, new RegExp(`^${cluster}\\s`, 'm'));
  ok(merged.stdout.endsWith(kubeconfig), `the merge prints the kubeconfig path:\n${merged.output}`);
  practiseAgain();

  // The cluster is stopped: the second message, then its fix.
  runAll([`k3d cluster stop ${cluster}`]);
  shows(run(`${everyTime[1]} --request-timeout=5s`).output, problems[1].message);
  runAll(problems[1].commands);
  practiseAgain();

  // No current context: the third message comes from the dashboard on localhost:8080. Then its fix.
  equal(run('kubectl config unset current-context').status, 0);
  const dashboard = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api').stdout === '404';
  const noContext = run(`${everyTime[1]} --request-timeout=5s`).output;
  if (dashboard) shows(noContext, problems[2].message);
  else shows(noContext, problems[1].message);
  runAll(problems[2].commands);
  practiseAgain();

  // The first Try it reaches the practice cluster: the Pod lesson's download runs on its node.
  const pod = lessonContent.pod;
  writeFileSync(join(folder, pod.filename), lessonText(renderLesson(pod, pod.blocks.length - 1, defaultLessonValues(pod), true)));
  match(run(`kubectl apply -f ${pod.filename}`).output, /pod\/web created/);
  equal(run('kubectl wait --for=condition=Ready pod/web --timeout=180s').status, 0);
  equal(run("kubectl get pod web -o jsonpath='{.spec.nodeName}'").stdout, `${context}-server-0`);

  // Deleting the cluster removes its context, and k3d switches kubectl to another cluster in the file, as after Lab 1's
  // last step. That is why learners run the every-time commands before each Try it.
  equal(run(`k3d cluster delete ${cluster}`).status, 0);
  ok(!run('kubectl config get-contexts -o name').stdout.split('\n').includes(context));
  equal(run('kubectl config current-context').stdout, other);
});
