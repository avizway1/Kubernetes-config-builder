// Run a lab guide's own commands in order, the way a learner would, and time the run.
// Usage: node tests/lab-guide.check.mjs docs/<lab>.md   (run from the project root)
//
// The guide is the test. Every line in a ```bash block runs once and must succeed.
// Hidden HTML comments add what a learner does by hand or sees with their eyes:
//   <!-- do: <command> -->     runs once, like editing a file in a text editor.
//   <!-- check: <command> -->  must succeed, retried for up to LKME_LAB_RETRY_SECONDS (default 120).
// A few commands need a stand-in because a learner runs them differently:
//   kubectl port-forward ...   runs in the background and restarts before each check, as the guide tells learners to.
//   ... --watch                is skipped; the checks after it wait for the same result.
//   curl -fsSLO <raw GitHub URL of this repository>  copies the same file from this checkout, so unpushed changes are tested.
//   ~/lab-N                    becomes a temporary folder.
// Environment:
//   KUBECONFIG is set to a project-local file, so the learner's own kubeconfig is never touched.
//   LKME_LAB_SET='{"old text":"new text"}' replaces text in commands, for example a placeholder Region.
//   LKME_LAB_LIMIT_SECONDS fails the run if the lab takes longer, timed from cluster creation.
// If a step fails after the cluster is created, the commands in the guide's "Clean up" section run before the check exits.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guidePath = process.argv[2];
if (!guidePath) {
  console.error('Usage: node tests/lab-guide.check.mjs docs/<lab>.md');
  process.exit(2);
}
const rawPrefix = 'https://raw.githubusercontent.com/avizway1/learning-kubernetes-made-easy/main/';
const retrySeconds = Number(process.env.LKME_LAB_RETRY_SECONDS ?? 120);
const limitSeconds = Number(process.env.LKME_LAB_LIMIT_SECONDS ?? 0);
const replacements = Object.entries(JSON.parse(process.env.LKME_LAB_SET ?? '{}'));
const lab = path.basename(guidePath, '.md');
const work = mkdtempSync(path.join(os.tmpdir(), `${lab}-`));
const env = { ...process.env, KUBECONFIG: path.join(root, '.runtime', `kubeconfig-${lab}`), AWS_PAGER: '' };

/** Read the guide into an ordered list of steps: {kind: 'run' | 'do' | 'check', command, section}. */
function readGuide(text) {
  const steps = [];
  let section = '';
  let fence = null;
  let pending = '';
  for (const line of text.split('\n')) {
    if (fence === null) {
      const heading = line.match(/^#+ (.*)/);
      if (heading) section = heading[1];
      const open = line.match(/^```(\w*)\s*$/);
      if (open) fence = open[1];
      const hidden = line.match(/^<!-- (do|check): (.*) -->$/);
      if (hidden) steps.push({ kind: hidden[1], command: hidden[2], section });
      continue;
    }
    if (line.startsWith('```')) {
      fence = null;
      continue;
    }
    if (fence !== 'bash') continue;
    if (line.endsWith('\\')) {
      pending += line.slice(0, -1) + ' ';
      continue;
    }
    const command = (pending + line).trim();
    pending = '';
    if (command && !command.startsWith('#')) steps.push({ kind: 'run', command, section });
  }
  return steps;
}

function prepare(command) {
  let result = command.replaceAll(/~\/lab-\d+/g, work);
  for (const [from, to] of replacements) result = result.replaceAll(from, to);
  if (result.startsWith(`curl -fsSLO ${rawPrefix}`)) {
    const file = result.slice(`curl -fsSLO ${rawPrefix}`.length);
    result = `cp '${path.join(root, file)}' .`;
  }
  return result;
}

// One long-lived shell, like a learner's terminal, so `cd` and `export` carry over to later commands.
const shell = spawn('bash', ['--noprofile', '--norc'], { cwd: work, env, stdio: ['pipe', 'pipe', 'inherit'] });
const marker = '__LKME_LAB_DONE__';
let pending = null;
let buffer = '';
shell.stdout.setEncoding('utf8');
shell.stdout.on('data', chunk => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline + 1);
    buffer = buffer.slice(newline + 1);
    if (line.startsWith(marker)) {
      const done = pending;
      pending = null;
      done.resolve({ status: Number(line.slice(marker.length)), output: done.output });
    } else if (pending) {
      pending.output += line;
      if (!pending.quiet) process.stdout.write(line);
    }
  }
});

function bash(command, { quiet = false } = {}) {
  return new Promise(resolve => {
    pending = { resolve, quiet, output: '' };
    shell.stdin.write(`{\n${command}\n} </dev/null 2>&1; printf '\\n${marker}%s\\n' "$?"\n`);
  });
}

let forward = null;
let forwardCommand = null;

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function restartForward() {
  if (!forwardCommand) return;
  if (forward) forward.kill();
  const port = Number(forwardCommand.match(/ (\d+):\d+/)[1]);
  for (let i = 0; i < 20 && await portOpen(port); i += 1) await new Promise(r => setTimeout(r, 250));
  forward = spawn('bash', ['-c', `exec ${forwardCommand}`], { cwd: work, env, stdio: 'ignore' });
  for (let i = 0; i < 40 && !await portOpen(port); i += 1) await new Promise(r => setTimeout(r, 250));
}

const steps = readGuide(readFileSync(guidePath, 'utf8'));
let started = null;
let finished = null;
let failed = null;
let created = false;

for (const step of steps) {
  const command = prepare(step.command);
  const label = step.kind === 'run' ? '$' : step.kind;
  if (command.includes(' --watch')) {
    console.log(`skip (watch): ${command}`);
    continue;
  }
  if (command.startsWith('kubectl port-forward ')) {
    console.log(`background: ${command}`);
    forwardCommand = command;
    await restartForward();
    continue;
  }
  if (/\b(k3d|eksctl) (cluster )?create\b/.test(command) && started === null) started = Date.now();
  console.log(`${label} ${command}`);
  if (step.kind === 'check') {
    const deadline = Date.now() + retrySeconds * 1000;
    let result;
    for (;;) {
      if (/localhost:\d+/.test(command)) await restartForward();
      result = await bash(command, { quiet: true });
      if (result.status === 0 || Date.now() > deadline) break;
      await new Promise(r => setTimeout(r, 5000));
    }
    if (result.status !== 0) {
      process.stdout.write(result.output);
      failed = `check failed in "${step.section}": ${command}`;
      break;
    }
    continue;
  }
  const result = await bash(command);
  if (result.status !== 0) {
    failed = `command failed in "${step.section}": ${command}`;
    break;
  }
  if (/\b(k3d|eksctl) (cluster )?create\b/.test(command)) created = true;
  if (/\b(k3d|eksctl) (cluster )?delete\b/.test(command)) finished = Date.now();
}

if (forward) forward.kill();
if (failed && !created) console.error(`\n${failed}\nNothing was created, so there is nothing to clean up.`);
if (failed && created) {
  console.error(`\n${failed}\nRunning the guide's clean-up commands.`);
  for (const step of steps.filter(s => s.section.includes('Clean up') && s.kind === 'run')) {
    const command = prepare(step.command);
    console.error(`$ ${command}`);
    await bash(command);
  }
}
shell.stdin.end();
rmSync(work, { recursive: true, force: true });
rmSync(env.KUBECONFIG, { force: true });
if (failed) process.exit(1);

const seconds = Math.round(((finished ?? Date.now()) - (started ?? Date.now())) / 1000);
const tools = {
  docker: "docker version --format 'Docker {{.Server.Version}}'",
  k3d: 'k3d version | head -1',
  eksctl: 'echo eksctl $(eksctl version)',
  aws: 'aws --version | cut -d" " -f1',
  kubectl: "kubectl version --client | head -1",
};
const used = Object.entries(tools).filter(([tool]) => steps.some(step => step.command.includes(`${tool} `)));
const versions = [spawnSync('uname', ['-sm'], { encoding: 'utf8' }).stdout.trim(),
  ...used.map(([, command]) => spawnSync('bash', ['-c', command], { encoding: 'utf8' }).stdout.trim())].join(', ');
console.log(`\n${lab} passed in ${seconds} seconds, timed from cluster creation to deletion. ${versions}.`);
if (limitSeconds && seconds > limitSeconds) {
  console.error(`That is over the ${limitSeconds}-second target.`);
  process.exit(1);
}
