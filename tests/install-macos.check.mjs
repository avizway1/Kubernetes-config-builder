// Run scripts/install-macos.sh, read the check it prints the way the dashboard does, then run it again and expect every
// tool skipped. See specs/install-scripts.md.
// CI runs it on a GitHub-hosted macOS runner with LKME_SKIP_DOCKER=1, because the runner can't run Docker Desktop.
// On a Mac that already has every tool, it changes nothing and must not ask for a password.
// Run from the project root on macOS: node --test tests/install-macos.check.mjs
import { equal, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readReport, systemLabel } from '../frontend/src/setup-check.ts';

const skipDocker = process.env.LKME_SKIP_DOCKER === '1';

function install() {
  // No terminal input, so a password prompt fails at once instead of waiting.
  const result = spawnSync('bash', ['scripts/install-macos.sh', ...(skipDocker ? ['--skip-docker'] : [])], {
    encoding: 'utf8', input: '', timeout: 30 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  console.log(`${result.stdout}${result.stderr}`);
  equal(result.status, 0, result.stderr);
  return result.stdout;
}

function checkOutput(output) {
  const found = output.match(/----- Copy from the next line -----\n([\s\S]*?)\n----- to the line before this one -----/);
  ok(found, `no check output in:\n${output}`);
  return found[1];
}

test('install-macos.sh installs kubectl, k3d, the AWS CLI, and eksctl, and a second run skips them', { timeout: 40 * 60 * 1000 }, () => {
  equal(process.platform, 'darwin', 'run this on macOS');
  const first = install();
  for (const label of ['System', 'CPU', 'Architecture', 'Memory', 'Free disk']) match(first, new RegExp(`^    ${label}: +\\S`, 'm'));
  match(first, /^    System: +macOS \d+/m);

  const report = readReport(checkOutput(first));
  equal(report.valid, true);
  equal(systemLabel(report.system), 'macOS', report.system);
  for (const id of ['kubectl', 'k3d', 'aws', 'eksctl']) equal(report.tools[id]?.ready, true, `${id}: ${report.tools[id]?.message}`);
  if (!skipDocker) equal(report.tools.docker?.ready, true, report.tools.docker?.message);

  const second = install();
  ok(!/Installing|Downloading/.test(second), 'the second run installed something');
  for (const tool of ['git version', 'kubectl v', 'k3d version', 'aws-cli/2', 'eksctl ']) {
    ok(second.includes(`Already installed: ${tool}`), `the second run didn't skip ${tool}`);
  }
});
