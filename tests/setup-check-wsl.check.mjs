// Follow the setup page's Windows (WSL 2) card in Ubuntu on WSL 2, then read the check's output the way the dashboard does.
// CI runs this on a GitHub-hosted windows-2025 runner after `wsl --install -d Ubuntu`. See specs/setup-check.md.
// Usage, on Windows from the project root: node tests/setup-check-wsl.check.mjs
//
// The runner has no Docker Desktop and no AWS sign-in, so Docker must read as not running and AWS as signed out.
// Everything else must read as ready.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readReport, setup, systemLabel, toolLabels } from '../frontend/src/setup-check.ts';

const distro = process.env.KCB_WSL_DISTRO ?? 'Ubuntu';
const user = 'learner';
// wsl.exe prints its own messages in UTF-16 unless WSL_UTF8 is set.
const env = { ...process.env, WSL_UTF8: '1' };

// Scripts are written into the checkout and run in Ubuntu through its /mnt path, so bash reads each command exactly as written.
const folder = join(process.cwd(), '.runtime', 'wsl');
mkdirSync(folder, { recursive: true });
const linuxPath = file => file.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replaceAll('\\', '/');

function run(name, text, { as = user, capture = false } = {}) {
  const file = join(folder, `${name}.sh`);
  writeFileSync(file, `${text.replace(/\r\n/g, '\n')}\n`);
  console.log(`\n$ # ${name}, as ${as}\n${text}`);
  return execFileSync('wsl.exe', ['-d', distro, '-u', as, '--cd', '~', '--', 'bash', linuxPath(file)], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    timeout: 10 * 60 * 1000,
  });
}

// WSL 2 runs a real Linux kernel built by Microsoft. WSL 1 would report a Windows build number instead.
const kernel = run('kernel', 'uname -r', { as: 'root', capture: true }).trim();
console.log(kernel);
assert.match(kernel, /WSL2/i, `Ubuntu is not running on WSL 2: ${kernel}`);

// A learner's Ubuntu user can use sudo. The password prompt is skipped here, since nobody types it.
run('learner', `id ${user} >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --groups sudo ${user}
echo '${user} ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/${user}`, { as: 'root' });

// The Windows card's commands, in its order. The AWS CLI card says to install unzip first if it is missing.
const before = { aws: 'command -v unzip >/dev/null || { sudo apt-get update -q && sudo apt-get install -y -q unzip; }' };
for (const tool of setup.tools) {
  const commands = tool.install.windows.commands;
  if (!commands) continue;
  run(`install-${tool.id}`, ['set -euo pipefail', before[tool.id], commands].filter(Boolean).join('\n'));
}

// The check exactly as the setup page shows it, in bash as the learner pastes it.
const output = run('check', setup.check, { capture: true });
console.log(output);
const lines = output.trim().split('\n');
assert.deepEqual(lines.map(line => line.split(' ')[0]), ['kms-check', 'system', ...Object.keys(toolLabels)], 'the check prints one line per tool');
assert.ok(!/\b\d{12}\b/.test(output), 'the check printed something like an AWS account number');

const report = readReport(output);
assert.equal(report.valid, true);
assert.equal(systemLabel(report.system), 'Windows (WSL 2)', report.system);
for (const id of ['kubectl', 'k3d', 'aws', 'eksctl']) assert.equal(report.tools[id]?.ready, true, `${id}: ${report.tools[id]?.message}`);
assert.equal(report.tools.docker?.message, 'Docker is not running', 'the runner has no Docker Desktop');
assert.equal(report.tools['aws-signed-in']?.message, 'Not signed in to AWS', 'the runner has no AWS sign-in');
console.log(`\nThe check ran in Ubuntu on WSL 2 (${kernel}) and reads as ${systemLabel(report.system)}:`);
for (const result of Object.values(report.tools)) console.log(`${result.ready ? 'ready' : 'not ready'}: ${result.message}`);
