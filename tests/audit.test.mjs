// Run: node --test tests/audit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const AUDIT = path.join(here, '..', 'scripts', 'audit.mjs');
const fixture = (name) => path.join(here, 'fixtures', name);

const run = (cwd, args, input) => spawnSync(process.execPath, [AUDIT, ...args], { cwd, input, encoding: 'utf8' });
const violations = (stdout) =>
  stdout.split('\n').map((l) => l.match(/^(.+?):(\d+) {2}(\S+) {2}/)).filter(Boolean).map((m) => `${m[1]}:${m[2]} ${m[3]}`).sort();
const hook = (cwd, filePath) => run(cwd, ['hook'], JSON.stringify({ tool_name: 'Edit', cwd, tool_input: { file_path: filePath } }));

function copyFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-'));
  fs.cpSync(fixture(name), dir, { recursive: true });
  return dir;
}

const EXPECTED = {
  js: [
    'src/atoms/Button.tsx:1 duplicate',
    'src/molecules/Button/index.tsx:1 duplicate',
    'src/molecules/SearchBar.tsx:2 import-direction',
    'src/molecules/SearchBar.tsx:5 hardcoded-value',
    'src/molecules/SearchBar.tsx:5 missed-reuse',
    'src/organisms/Header.tsx:4 hardcoded-value',
  ],
  flutter: [
    'lib/ui/molecules/search_bar.dart:2 import-direction',
    'lib/ui/molecules/search_bar.dart:5 hardcoded-value',
    'lib/ui/molecules/search_bar.dart:5 missed-reuse',
    'lib/ui/organisms/header.dart:3 hardcoded-value',
  ],
  compose: [
    'src/ui/molecules/SearchBar.kt:2 import-direction',
    'src/ui/molecules/SearchBar.kt:5 missed-reuse',
    'src/ui/molecules/SearchBar.kt:6 hardcoded-value',
    'src/ui/organisms/Header.kt:2 hardcoded-value',
  ],
  swiftui: [
    'App/UI/Molecules/SearchBar.swift:3 missed-reuse',
    'App/UI/Molecules/SearchBar.swift:4 hardcoded-value',
    'App/UI/Molecules/SearchBar.swift:5 hardcoded-value',
  ],
};

for (const [preset, expected] of Object.entries(EXPECTED)) {
  test(`check finds exactly the planted violations (${preset})`, () => {
    const r = run(fixture(preset), ['check', '--all']);
    assert.equal(r.status, 1, r.stderr);
    assert.deepEqual(violations(r.stdout), [...expected].sort());
  });
}

test('list shows components with usage counts and unused ones', () => {
  const r = run(fixture('js'), ['list']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /atoms\s+Input\s+1\s+src\/atoms\/Input\.tsx/);
  assert.match(r.stdout, /unused: Badge$/m);
});

test('hook blocks a file with violations and passes a clean one', () => {
  const dir = fixture('js');
  const bad = hook(dir, path.join(dir, 'src/molecules/SearchBar.tsx'));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /3 new violation/);
  assert.match(bad.stderr, /import-direction/);
  assert.equal(hook(dir, path.join(dir, 'src/pages/Home.tsx')).status, 0);
  assert.equal(hook(dir, 'src/molecules/SearchBar.tsx').status, 2, 'relative path resolves against cwd');
});

test('hook ignores non-UI files, ignored files and projects without config', () => {
  const dir = fixture('js');
  assert.equal(hook(dir, path.join(dir, 'atomic.config.json')).status, 0);
  assert.equal(hook(dir, path.join(dir, 'src/organisms/Header.test.tsx')).status, 0);
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-'));
  fs.writeFileSync(path.join(plain, 'App.tsx'), "const c = '#123456';\n");
  assert.equal(hook(plain, path.join(plain, 'App.tsx')).status, 0);
});

test('baseline hides existing violations and still reports new ones', () => {
  const dir = copyFixture('js');
  assert.equal(run(dir, ['baseline']).status, 0);
  assert.equal(run(dir, ['check']).status, 0);
  const file = path.join(dir, 'src/molecules/SearchBar.tsx');
  assert.equal(hook(dir, file).status, 0);
  fs.appendFileSync(file, "export const x = { margin: '12px' };\n");
  const r = hook(dir, file);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /1 new violation/);
  assert.match(r.stderr, /SearchBar\.tsx:7 {2}hardcoded-value/);
});

test('a broken config is reported without blocking the edit', () => {
  const dir = copyFixture('js');
  fs.writeFileSync(path.join(dir, 'atomic.config.json'), '{"preset":"cobol","levels":{}}');
  const r = hook(dir, path.join(dir, 'src/pages/Home.tsx'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown preset "cobol"/);
});
