// Run scripts/install-windows.ps1 on Windows with Ubuntu on WSL 2, read the check it prints the way the dashboard does,
// then run it again and expect every tool skipped. See specs/install-scripts.md.
// CI runs this on a GitHub-hosted windows-2025 runner after `wsl --install -d Ubuntu --no-launch --web-download`.
// The runner can't run Docker Desktop, so the script runs with -SkipDockerDesktop, and Docker reads as not running.
// Run from the project root on Windows, in PowerShell as administrator: node --test tests/install-windows.check.mjs
import { equal, match, ok } from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readReport, systemLabel } from '../frontend/src/setup-check.ts';

const env = { ...process.env, WSL_UTF8: '1' };
const user = 'learner';

function install() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts\\install-windows.ps1', '-SkipDockerDesktop'], {
    env, encoding: 'utf8', input: '', timeout: 30 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout}`.replace(/\r\n/g, '\n');
  console.log(output, result.stderr);
  equal(result.status, 0, result.stderr);
  return output;
}

function checkOutput(output) {
  const found = output.match(/----- Copy from the next line -----\n([\s\S]*?)\n----- to the line before this one -----/);
  ok(found, `no check output in:\n${output}`);
  return found[1];
}

test('install-windows.ps1 installs the tools inside Ubuntu on WSL 2, and a second run skips them', { timeout: 40 * 60 * 1000 }, () => {
  equal(process.platform, 'win32', 'run this on Windows');
  // Ubuntu with a user of its own, as a learner has after opening Ubuntu once. The password prompt is skipped here.
  execFileSync('wsl.exe', ['-d', 'Ubuntu', '-u', 'root', '-e', 'bash', '-c', `set -e
id ${user} >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --groups sudo ${user}
echo '${user} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${user}
grep -q '^default=${user}$' /etc/wsl.conf 2>/dev/null || printf '\\n[user]\\ndefault=${user}\\n' >> /etc/wsl.conf`], { env, stdio: 'inherit' });
  execFileSync('wsl.exe', ['--terminate', 'Ubuntu'], { env, stdio: 'inherit' });

  const first = install();
  for (const label of ['System', 'CPU', 'Architecture', 'Memory', 'Free disk']) match(first, new RegExp(`^    ${label}: +\\S`, 'm'));
  match(first, /Already installed: git version/);
  match(first, /Skipped, because of -SkipDockerDesktop\./);
  match(first, /Ready: Ubuntu \d+/);
  // Inside Ubuntu, install-linux.sh leaves Docker to Docker Desktop.
  match(first, /System: +Ubuntu .* \(WSL 2\)/);
  match(first, /Docker doesn't answer in Ubuntu yet/);

  const report = readReport(checkOutput(first));
  equal(report.valid, true);
  equal(systemLabel(report.system), 'Windows (WSL 2)', report.system);
  for (const id of ['kubectl', 'k3d', 'aws', 'eksctl']) equal(report.tools[id]?.ready, true, `${id}: ${report.tools[id]?.message}`);
  equal(report.tools.docker?.message, 'Docker is not running', 'the runner has no Docker Desktop');

  const second = install();
  ok(!/Installing|Downloading/.test(second), 'the second run installed something');
  for (const tool of ['kubectl v1.37.2', 'k3d version', 'aws-cli/2', 'eksctl ']) {
    ok(second.includes(`Already installed: ${tool}`), `the second run didn't skip ${tool}`);
  }
});
