// Run scripts/install-linux.sh in fresh Ubuntu and Debian containers as a learner with sudo, then read the check it prints
// the way the dashboard does. Then run it again, and expect every tool skipped. See specs/install-scripts.md.
// A container has no service manager, so Docker Engine is installed but reads as not running.
// Run from the project root with Docker: node --test tests/install-linux.check.mjs
// LKME_INSTALL_IMAGES picks the images, separated by spaces. The default is "ubuntu:26.04 debian:13".
import { equal, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readReport, systemLabel } from '../frontend/src/setup-check.ts';

const images = (process.env.LKME_INSTALL_IMAGES ?? 'ubuntu:26.04 debian:13').split(/\s+/).filter(Boolean);
const scripts = fileURLToPath(new URL('../scripts', import.meta.url));
const containers = [];

function docker(args, { input } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? '', output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

// What the script printed between its two marker lines.
function checkOutput(output) {
  const found = output.match(/----- Copy from the next line -----\r?\n([\s\S]*?)\r?\n----- to the line before this one -----/);
  ok(found, `no check output in:\n${output}`);
  return found[1];
}

after(() => {
  for (const name of containers) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
});

for (const image of images) {
  test(`install-linux.sh installs everything on ${image}, and a second run skips it all`, { timeout: 30 * 60 * 1000 }, () => {
    const name = `lkme-install-${image.replace(/[^a-z0-9]+/g, '-')}-${process.pid}`;
    containers.push(name);
    equal(docker(['run', '-d', '--name', name, '-v', `${scripts}:/scripts:ro`, image, 'sleep', 'infinity']).status, 0);

    // A learner's computer has sudo and a user of their own. The password prompt is skipped here, since nobody types it.
    const ready = docker(['exec', name, 'bash', '-c', `set -e
apt-get update -q >/dev/null
DEBIAN_FRONTEND=noninteractive apt-get install -y -q sudo >/dev/null
useradd --create-home --shell /bin/bash learner
echo 'learner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/learner`]);
    equal(ready.status, 0, ready.output);

    const asLearner = ['exec', '-u', 'learner', '-w', '/home/learner', '-e', 'HOME=/home/learner', '-e', 'USER=learner',
      '-e', 'DEBIAN_FRONTEND=noninteractive', name, 'bash', '/scripts/install-linux.sh'];
    const first = docker(asLearner);
    console.log(first.output);
    equal(first.status, 0, first.output);

    // What the script found about the laptop, before installing anything.
    for (const label of ['System', 'CPU', 'Architecture', 'Memory', 'Free disk']) match(first.stdout, new RegExp(`^    ${label}: +\\S`, 'm'));
    match(first.stdout, /Adding Docker's apt repository and installing Docker Engine\./);
    match(first.stdout, /Added learner to the docker group/);

    const report = readReport(checkOutput(first.stdout));
    equal(report.valid, true);
    equal(systemLabel(report.system), 'Linux', report.system);
    for (const id of ['kubectl', 'k3d', 'aws', 'eksctl']) equal(report.tools[id]?.ready, true, `${id}: ${report.tools[id]?.message}`);
    equal(report.tools.docker?.message, 'Docker is not running', 'a container has no service manager to start Docker');
    equal(report.tools['aws-signed-in']?.message, 'Not signed in to AWS');
    match(docker(['exec', name, 'docker', '--version']).stdout, /^Docker version /);
    match(docker(['exec', name, 'docker', 'compose', 'version']).stdout, /^Docker Compose version /);

    // A second run finds everything and installs nothing.
    const second = docker(asLearner);
    equal(second.status, 0, second.output);
    ok(!/Installing|Adding Docker/.test(second.stdout), `the second run installed something:\n${second.stdout}`);
    for (const tool of ['git version', 'Docker version', 'kubectl v1.37.2', 'k3d version', 'aws-cli/2', 'eksctl ']) {
      ok(second.stdout.includes(`Already installed: ${tool}`), `the second run didn't skip ${tool}:\n${second.stdout}`);
    }
    equal(checkOutput(second.stdout).split('\n').length, 8);
  });
}
