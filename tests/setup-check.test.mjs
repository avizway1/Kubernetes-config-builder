import { deepEqual, equal, match, ok } from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import {
  labMissing, labReady, labTools, readReport, setup, systemLabel, toolLabels, toolNeeds,
} from '../frontend/src/setup-check.ts';

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
