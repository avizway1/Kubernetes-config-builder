// The install scripts in /scripts stay in step with the setup page and the start guide. See specs/install-scripts.md.
// ShellCheck runs on both shell scripts. Without ShellCheck installed, set LKME_SKIP_SHELLCHECK=1 to skip that part.
import { deepEqual, equal, match, ok } from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setup } from '../frontend/src/setup-check.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shell = { macos: 'scripts/install-macos.sh', linux: 'scripts/install-linux.sh' };
const windows = 'scripts/install-windows.ps1';
const repository = 'avizway1/learning-kubernetes-made-easy';

test('each shell script runs the setup check exactly as step 4 shows it, and marks where to copy from', () => {
  for (const path of Object.values(shell)) {
    const script = read(path);
    const check = script.match(/<<'LKME_CHECK'\n([\s\S]*?)\nLKME_CHECK\n/);
    ok(check, `${path} has no check`);
    equal(check[1], setup.check, `${path} runs a different check`);
    match(script, /echo "----- Copy from the next line -----"\necho "\$output"\necho "----- to the line before this one -----"/);
  }
});

test('the scripts install the kubectl version the setup page installs', () => {
  const card = setup.tools.find(tool => tool.id === 'kubectl').install.linux.commands.match(/release\/(v[\d.]+)\//)[1];
  for (const path of Object.values(shell)) equal(read(path).match(/^KUBECTL_VERSION=(\S+)$/m)?.[1], card, path);
});

test('the setup page and the start guide download each script from this repository, and Windows runs the Linux script', () => {
  const guide = read('docs/getting-started.html').replaceAll('&amp;', '&');
  deepEqual(Object.keys(setup.installScript.systems), setup.systems.map(system => system.id));
  for (const [system, script] of Object.entries(setup.installScript.systems)) {
    const path = `scripts/${script.file}`;
    ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
    ok(script.commands.includes(`https://raw.githubusercontent.com/${repository}/main/${path}`), `${system} downloads another file`);
    // The script's own comment shows the same commands.
    for (const line of script.commands.split('\n')) {
      ok(read(path).includes(line), `${path} doesn't show: ${line}`);
      ok(guide.includes(line), `the start guide is missing: ${line}`);
    }
    ok(guide.includes(`${setup.installScript.source}${script.file}`), `the start guide doesn't link to ${script.file}`);
  }
  equal(setup.installScript.source, `https://github.com/${repository}/blob/main/scripts/`);
  match(read(windows), new RegExp(`\\$LinuxScriptUrl = 'https://raw\\.githubusercontent\\.com/${repository}/main/scripts/install-linux\\.sh'`));
});

test('the scripts never accept an agreement, sign in, or change settings for the learner', () => {
  for (const path of [...Object.values(shell), windows]) {
    // Comments, and the hint that tells learners how to sign in themselves, are left out.
    const code = read(path).split('\n').filter(line => !/^\s*#/.test(line)).join('\n')
      .replace('say "For Lab 2, sign in to AWS with aws configure, or aws sso login, then run the check again."', '');
    for (const forbidden of [/--accept-license/, /--accept-(package|source)-agreements/, /aws configure/, /aws sso login/, /docker login/,
      /Set-ExecutionPolicy/, /k3d cluster create/, /chsh|\.bashrc|\.zshrc|\.profile/]) {
      ok(!forbidden.test(code), `${path} matches ${forbidden}`);
    }
    // Plain ASCII, so Windows PowerShell 5.1 and every terminal read it the same way.
    match(read(path), /^[\x09\x0a\x0d\x20-\x7e]+$/, `${path} has a character outside ASCII`);
  }
  // Git keeps LF line endings in the shell scripts, also in a Windows clone, so bash runs them in Ubuntu.
  match(read('.gitattributes'), /^\*\.sh text eol=lf$/m);
});

test('ShellCheck passes on both shell scripts', { skip: process.env.LKME_SKIP_SHELLCHECK === '1' }, () => {
  const result = spawnSync('shellcheck', ['-s', 'bash', ...Object.values(shell)], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  ok(!result.error, 'ShellCheck is not installed. Install it, or set LKME_SKIP_SHELLCHECK=1 to skip this test.');
  equal(result.status, 0, result.stdout + result.stderr);
});
