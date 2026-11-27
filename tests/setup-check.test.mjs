import { deepEqual, equal, match, ok } from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  labMissing, labReady, labTools, readReport, setup, systemLabel, toolLabels, toolNeeds,
} from '../frontend/src/setup-check.ts';
import { lessonContent } from '../frontend/src/lesson-builder.ts';

// Real output: macOS from the project Mac in zsh on 2026-11-26, and Linux from the check run in bash inside nginx:1.30.4.
// WSL 2 adds " WSL" after the system, as the windows-2025 CI job shows. That runner has no Docker Desktop, so this
// report's Docker line is one a Windows laptop with Docker Desktop would print.
const macos = `lkme-check 1
system Darwin arm64
docker 29.8.2 memory 9328558080
kubectl v1.36.1
k3d v5.9.0
aws aws-cli/2.36.37
aws-signed-in yes
eksctl 0.231.0-dev+f671416a1.2026-10-02T23:16:13Z`;

const linuxBare = `lkme-check 1
system Linux aarch64
docker not-running
kubectl missing
k3d missing
aws missing
aws-signed-in no
eksctl missing`;

const wsl = `lkme-check 1
system Linux x86_64 WSL
docker 29.8.2 memory 8217387008
kubectl v1.37.2
k3d v5.9.0
aws missing
aws-signed-in no
eksctl missing`;

const withLine = (report, line) => report.replace(new RegExp(`^${line.split(' ')[0]} .*$`, 'm'), line);

test('a passing macOS report unlocks both labs', () => {
  const report = readReport(macos);
  equal(report.valid, true);
  equal(systemLabel(report.system), 'macOS');
  ok(Object.values(report.tools).every(result => result.ready), JSON.stringify(report.tools));
  equal(labReady(report, 'lab-1'), true);
  equal(labReady(report, 'lab-2'), true);
  deepEqual(labMissing(report, 'lab-2'), []);
});

test('a report with nothing installed names every tool for each lab', () => {
  const report = readReport(linuxBare);
  equal(systemLabel(report.system), 'Linux');
  equal(labReady(report, 'lab-1'), false);
  deepEqual(labMissing(report, 'lab-1').map(result => result.message), ['Docker is not running', 'kubectl is missing', 'k3d is missing']);
  deepEqual(labMissing(report, 'lab-2').map(result => result.id), ['aws', 'aws-signed-in', 'eksctl', 'kubectl']);
  ok(labMissing(report, 'lab-1').every(result => result.fix), 'every failure says how to fix it');
});

test('a WSL 2 report shows as Windows and unlocks only the lab its tools cover', () => {
  const report = readReport(wsl.replaceAll('\n', '\r\n'));
  equal(systemLabel(report.system), 'Windows (WSL 2)');
  equal(labReady(report, 'lab-1'), true);
  equal(labReady(report, 'lab-2'), false);
});

test('each failure the spec lists is caught with its own message', () => {
  const cases = [
    ['docker not-running', 'docker', /^Docker is not running$/],
    ['kubectl missing', 'kubectl', /^kubectl is missing$/],
    ['k3d missing', 'k3d', /^k3d is missing$/],
    ['aws missing', 'aws', /^AWS CLI is missing$/],
    ['eksctl missing', 'eksctl', /^eksctl is missing$/],
    ['kubectl v1.35.4', 'kubectl', /too old for Kubernetes 1\.37/],
    ['kubectl v1.39.0', 'kubectl', /too new for Kubernetes 1\.37/],
    ['k3d v5.8.3', 'k3d', /older than 5\.9\.0/],
    ['aws aws-cli/1.33.4', 'aws', /is not version 2/],
    ['aws-signed-in no', 'aws-signed-in', /^Not signed in to AWS$/],
    ['eksctl 0.230.0', 'eksctl', /older than 0\.231\.0/],
  ];
  for (const [line, id, message] of cases) {
    const report = readReport(withLine(macos, line));
    const result = report.tools[id];
    equal(result.ready, false, line);
    match(result.message, message, line);
    ok(result.fix, `${line} says how to fix it`);
    const lab = Object.entries(labTools).find(([, tools]) => tools.includes(id))[0];
    equal(labReady(report, lab), false, `${line} locks ${lab}`);
  }
  // The edges of each version rule pass.
  for (const line of ['kubectl v1.36.0', 'kubectl v1.38.9', 'k3d v5.9.0', 'k3d v6.0.0', 'eksctl 0.231.0', 'eksctl 1.0.0']) {
    equal(readReport(withLine(macos, line)).tools[line.split(' ')[0]].ready, true, line);
  }
});

test('only the check output counts: other text is ignored, and a missing line is not checked yet', () => {
  equal(readReport('docker 29.8.2 memory 1\nkubectl v1.37.2').valid, false);
  equal(labReady(readReport('docker 29.8.2 memory 1\nkubectl v1.37.2\nk3d v5.9.0'), 'lab-1'), false);
  const noisy = readReport(`Last login: Thu Nov 26 09:00:00 on ttys001\n\n${macos}\nhello world\n`);
  equal(noisy.valid, true);
  equal(labReady(noisy, 'lab-2'), true);
  const partial = readReport(macos.replace(/^k3d .*\n/m, ''));
  equal(labReady(partial, 'lab-1'), false);
  deepEqual(labMissing(partial, 'lab-1'), [{ id: 'k3d', ready: false, message: 'k3d not checked yet' }]);
});

test('the check command runs unchanged in bash and zsh, prints only tool lines, and keeps the AWS account private', () => {
  // The AWS identity call is silenced, so the account number never reaches the screen or the dashboard.
  match(setup.check, /aws sts get-caller-identity >\/dev\/null 2>&1/);
  const names = ['lkme-check', 'system', ...Object.keys(toolLabels)];
  for (const shell of ['/bin/bash', '/bin/zsh'].filter(existsSync)) {
    // A bare PATH, so the result does not depend on the tools on this machine.
    const output = execFileSync(shell, ['-c', setup.check], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
    const lines = output.trim().split('\n');
    deepEqual(lines.map(line => line.split(' ')[0]), names, `${shell}: ${output}`);
    const report = readReport(output);
    equal(report.valid, true, shell);
    deepEqual(Object.keys(report.tools).sort(), Object.keys(toolLabels).sort(), shell);
    ok(!/\b\d{12}\b/.test(output), `${shell} printed something like an AWS account number`);
  }
});

test('the setup page covers every tool on macOS, Windows (WSL 2), and Linux with official sources', () => {
  deepEqual(setup.systems.map(system => system.id), ['macos', 'windows', 'linux']);
  deepEqual(setup.tools.map(tool => tool.id), ['docker', 'kubectl', 'k3d', 'aws', 'eksctl']);
  for (const tool of setup.tools) {
    ok(toolNeeds[tool.id], `${tool.id} has no version rule`);
    ok(tool.sources.length && tool.sources.every(source => source.url.startsWith('https://')), `${tool.id} sources`);
    for (const system of setup.systems) {
      const install = tool.install[system.id];
      ok(install?.text, `${tool.id} on ${system.id} has no instructions`);
      // Windows labs run in Ubuntu on WSL 2, so its commands are Linux commands, never PowerShell.
      if (system.id === 'windows' && install.commands) {
        ok(!/scoop|winget|choco|\$env:|Invoke-/i.test(install.commands), `${tool.id} on Windows uses PowerShell`);
      }
    }
  }
  // The kubectl the cards install fits the version rule.
  for (const install of Object.values(setup.tools.find(tool => tool.id === 'kubectl').install)) {
    for (const [, minor] of install.commands?.matchAll(/v1\.(\d+)\.\d+/g) ?? []) ok(Number(minor) >= 36 && Number(minor) <= 38, minor);
  }
  equal(setup.windowsFirst.steps[0].commands, 'wsl --install -d Ubuntu');
  ok(setup.windowsFirst.sources.every(source => source.url.startsWith('https://')));
});

// Charan's changes on 2026-11-27 in specs/setup-check.md.
test('the setup page opens with what the laptop needs and ends with one practice cluster path the start guide also gives', () => {
  const guide = readFileSync(new URL('../docs/getting-started.html', import.meta.url), 'utf8');
  const needs = setup.requirements.items;
  deepEqual(needs.map(item => item.label).slice(0, 3), ['Memory', 'Disk', 'System']);
  // The same values as the start guide's Check your laptop step.
  ok(needs[0].text.startsWith('8 GB of RAM or more.') && guide.includes('8 GB of RAM or more.'));
  ok(needs[1].text === 'About 10 GB free.' && guide.includes('about 10 GB free'));
  deepEqual(Object.keys(needs[2].systems), setup.systems.map(system => system.id));
  match(needs[2].systems.windows, /Windows 10 22H2 or Windows 11 23H2 or later, Pro, Enterprise, or Education, with WSL 2/);
  match(guide, /64-bit Windows 10 \(22H2\) or Windows 11 \(23H2 or later\), Pro, Enterprise, or Education/);
  ok(setup.requirements.sources.every(source => source.url.startsWith('https://')));

  // One path from scratch: create once, then switch every time. No step asks the learner to decide which branch applies.
  const { steps, problems } = setup.practiceCluster;
  deepEqual(steps.map(step => step.commands.split('\n')), [
    ['k3d cluster create practice --image rancher/k3s:v1.37.2-k3s1 --wait', 'kubectl config use-context k3d-practice', 'kubectl get nodes'],
    ['kubectl config use-context k3d-practice', 'kubectl get nodes'],
  ]);
  for (const step of steps) {
    ok(step.text && step.expect, step.title);
    ok(!/^If /.test(step.title), `${step.title} is a branch, not a step`);
  }
  // Then one fix for each message learners see, as K3s 1.37.2 and k3d 5.9.0 print it.
  deepEqual(problems.map(problem => problem.message), [
    'error: no context exists with the name: "k3d-practice"',
    'The connection to the server ... was refused',
    'the server could not find the requested resource',
    "Failed to create cluster 'practice' because a cluster with that name already exists",
  ]);
  deepEqual(problems.map(problem => problem.commands ?? ''), [
    'k3d cluster list\nk3d kubeconfig merge practice --kubeconfig-merge-default --kubeconfig-switch-context',
    'k3d cluster start practice',
    'kubectl config use-context k3d-practice',
    '',
  ]);
  for (const item of [...steps, ...problems]) {
    ok(item.sources.length && item.sources.every(source => /^https:\/\/(k3d\.io|kubernetes\.io)\//.test(source.url)), item.title ?? item.message);
    // The start guide gives the same commands.
    for (const line of (item.commands ?? '').split('\n').filter(Boolean)) ok(guide.includes(line), `the start guide is missing: ${line}`);
  }
  // The start guide shows the same messages, apart from the long create message, which it shortens.
  for (const problem of problems.slice(0, 3)) ok(guide.includes(problem.message), `the start guide is missing: ${problem.message}`);
});

test('every command learners copy is plain text a terminal accepts', () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const commands = [
    ['the check', setup.check],
    ...setup.tools.flatMap(tool => Object.entries(tool.install).filter(([, install]) => install.commands)
      .map(([system, install]) => [`${tool.id} on ${system}`, install.commands])),
    ...setup.windowsFirst.steps.filter(step => step.commands).map(step => ['WSL', step.commands]),
    ...setup.practiceCluster.steps.map(step => [step.title, step.commands]),
    ...Object.values(lessonContent).flatMap(lesson => lesson.tryIt.map(item => [lesson.id, item.command])),
    ...['docs/lab-1-hello-kubernetes.md', 'docs/lab-2-your-app-on-eks.md', 'README.md', 'docs/contributing.md']
      .flatMap(path => [...read(path).matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)].map(match => [path, match[1]])),
    ...[...read('docs/getting-started.html').matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)]
      .map(match => ['start guide', match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')]),
  ];
  ok(commands.length > 280, `${commands.length} command blocks`);
  for (const [where, text] of commands) {
    // No curly quotes, long dashes, or non-breaking spaces, which shells reject, and no prompt or tab to remove first.
    match(text, /^[\x20-\x7e\n]+$/, `${where}: ${text}`);
    ok(!/^\s*\$ /m.test(text), `${where} starts with a prompt: ${text}`);
    // The start guide's code blocks hold commands only, no markup.
    if (where === 'start guide') ok(!/<[a-z]/.test(text), `${where}: ${text}`);
  }
});
