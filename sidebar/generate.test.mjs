import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSidebar, firstHeading, humanise, main, parseFrontmatter, walk } from './generate.mjs';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'docs');

/** A throwaway docs/ tree: { 'a.md': '# A', 'sub/README.md': '...' }. */
function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'acro-sidebar-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const labels = (nodes) => nodes.map((n) => n.label);

// ------------------------------------------------------------------- frontmatter

test('frontmatter: plain, quoted, and commented scalars', () => {
  const fm = parseFrontmatter(
    "---\ntitle: \"Widgets: a primer\"\nsidebar_label: 'It''s short'\nsidebar_position: 2 # after intro\n---\n# H\n",
  );
  assert.equal(fm.title, 'Widgets: a primer');
  assert.equal(fm.sidebar_label, "It's short");
  assert.equal(fm.sidebar_position, '2');
});

test('frontmatter: a BOM and CRLF line endings do not hide it', () => {
  // Files edited on Windows carry both, and a missed frontmatter block means the H1
  // search runs over YAML and the page gets the wrong title.
  const fm = parseFrontmatter('﻿---\r\ntitle: Tokens\r\n---\r\nBody');
  assert.equal(fm.title, 'Tokens');
});

test('frontmatter: absent or unterminated means none', () => {
  assert.deepEqual(parseFrontmatter('# Just a heading'), {});
  assert.deepEqual(parseFrontmatter('---\ntitle: never closed\n# H'), {});
});

test('first heading skips frontmatter and only takes an H1', () => {
  assert.equal(firstHeading('---\ntitle: x\n---\n## Not this\n# This one\n'), 'This one');
  assert.equal(firstHeading('No heading'), null);
  assert.equal(firstHeading('# Closed ATX heading ##\n'), 'Closed ATX heading');
});

test('humanise is the last resort, and only capitalises the first letter', () => {
  assert.equal(humanise('getting-started'), 'Getting started');
  assert.equal(humanise('api_v2'), 'Api v2');
});

// ------------------------------------------------------------------- tree rules

test('titles follow sidebar_label, then title, then H1, then filename', () => {
  const root = tree({
    'a.md': '---\nsidebar_label: Label\ntitle: Title\n---\n# Heading\n',
    'b.md': '---\ntitle: Title\n---\n# Heading\n',
    'c.md': '# Heading\n',
    'd-page.md': 'no heading',
  });
  try {
    assert.deepEqual(labels(walk(root)), ['Label', 'Title', 'Heading', 'D page']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('order is sidebar_position (decimals too), then filename; unpositioned pages come last', () => {
  const root = tree({
    'zeta.md': '# Zeta',
    'alpha.md': '# Alpha',
    'second.md': '---\nsidebar_position: 2\n---\n# Second',
    'between.md': '---\nsidebar_position: 1.5\n---\n# Between',
    'first.md': '---\nsidebar_position: 1\n---\n# First',
  });
  try {
    assert.deepEqual(labels(walk(root)), ['First', 'Between', 'Second', 'Alpha', 'Zeta']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('folders sort among pages by name, the same as acro-docs', () => {
  const root = tree({ 'b.md': '# B', 'a/x.md': '# X', 'c.md': '# C' });
  try {
    assert.deepEqual(labels(walk(root)), ['a', 'B', 'C']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('underscore and dot entries are never pages, nor are non-markdown files', () => {
  const root = tree({
    'page.md': '# Page',
    '_meta.yml': 'name: x',
    '_sidebar.md': '- old',
    '_partials/snippet.md': '# Partial',
    '.hidden.md': '# Hidden',
    'index.html': '<html>',
    'assets/diagram.png': 'png',
  });
  try {
    assert.deepEqual(labels(walk(root)), ['Page']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a folder README is the folder itself, linked as folder/', () => {
  const root = tree({
    'look-dev/README.md': '# Look development',
    'look-dev/shaders.md': '# Shaders',
  });
  try {
    const [folder] = walk(root);
    assert.equal(folder.label, 'Look development');
    assert.equal(folder.href, 'look-dev/');
    assert.deepEqual(labels(folder.children), ['Shaders']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an index.md or lowercase readme.md is linked by name, because Docsify only loads README.md for folder/', () => {
  // GitHub Pages is case-sensitive and Docsify requests exactly `folder/README.md`, so a
  // `folder/` link to anything else is a 404 on the live site even though it works locally.
  const root = tree({ 'guides/index.md': '# Guides', 'notes/readme.md': '# Notes' });
  try {
    const byLabel = Object.fromEntries(walk(root).map((n) => [n.label, n.href]));
    assert.equal(byLabel.Guides, 'guides/index');
    assert.equal(byLabel.Notes, 'notes/readme');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a folder without its own page keeps its name verbatim and has no link', () => {
  const root = tree({ 'api/tokens.md': '# Tokens' });
  try {
    const [folder] = walk(root);
    assert.equal(folder.label, 'api', 'not "Api": acro-docs shows the folder name as written');
    assert.equal(folder.href, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('_category_.json sets a folder label and position; a broken one is ignored', () => {
  const root = tree({
    'guides/_category_.json': '{ "label": "How-to guides", "position": 1 }',
    'guides/a.md': '# A',
    'broken/_category_.json': '{ not json',
    'broken/b.md': '# B',
    'aaa.md': '# Aaa',
  });
  try {
    assert.deepEqual(labels(walk(root)), ['How-to guides', 'Aaa', 'broken']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a folder with no pages anywhere beneath it is dropped', () => {
  const root = tree({ 'page.md': '# Page', 'assets/img.png': 'png', 'empty/deeper/x.txt': 'x' });
  try {
    assert.deepEqual(labels(walk(root)), ['Page']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------- output

test('the root README is left out: the site name at the top of the rail is the home link', () => {
  const root = tree({ 'README.md': '# Home', 'a.md': '# A' });
  try {
    const out = buildSidebar(root, 'test');
    assert.doesNotMatch(out, /\[Home\]/);
    assert.match(out, /^- \[A\]\(a\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('brackets in a title are escaped so they cannot end the link text', () => {
  const root = tree({ 'arrays.md': '# Array [x] syntax' });
  try {
    assert.match(buildSidebar(root, 'test'), /^- \[Array \\\[x\\\] syntax\]\(arrays\)$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('_sidebar.extra.md is appended after a divider, verbatim', () => {
  const root = tree({
    'a.md': '# A',
    '_sidebar.extra.md': '- [Elsewhere](https://example.com/)\n',
  });
  try {
    const out = buildSidebar(root, 'test');
    assert.match(out, /\n---\n\n- \[Elsewhere\]\(https:\/\/example\.com\/\)\n$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------- cli

/** Runs main() with console output silenced; returns its exit code. */
function quietMain(argv) {
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = () => {};
  try {
    return main(argv);
  } finally {
    [console.log, console.warn, console.error] = saved;
  }
}

test('several folders: each gets its own sidebar, and --check covers all of them', () => {
  const a = tree({ 'one.md': '# One' });
  const b = tree({ 'two.md': '# Two' });
  try {
    assert.equal(quietMain([a, b]), 0);
    assert.match(readFileSync(path.join(a, '_sidebar.md'), 'utf8'), /\[One\]\(one\)/);
    assert.match(readFileSync(path.join(b, '_sidebar.md'), 'utf8'), /\[Two\]\(two\)/);
    assert.equal(quietMain([a, b, '--check']), 0);

    writeFileSync(path.join(b, 'three.md'), '# Three');
    assert.equal(quietMain([a, b, '--check']), 1, 'a stale second folder fails the check');
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('a missing folder fails the run but does not stop the others', () => {
  const a = tree({ 'one.md': '# One' });
  try {
    assert.equal(quietMain([path.join(a, 'nope'), a]), 2);
    assert.match(readFileSync(path.join(a, '_sidebar.md'), 'utf8'), /\[One\]\(one\)/);
  } finally {
    rmSync(a, { recursive: true, force: true });
  }
});

test('--stdout refuses several folders, since their output would run together', () => {
  assert.equal(quietMain(['a', 'b', '--stdout']), 2);
});

test('the committed fixture sidebar is exactly what the generator produces', () => {
  // CI also runs `--check` on it; this makes the same failure visible in `npm test`.
  const committed = readFileSync(path.join(FIXTURE, '_sidebar.md'), 'utf8').replace(/\r\n/g, '\n');
  const strip = (s) => s.replace(/^<!--[\s\S]*?-->\n/, '');
  assert.equal(strip(committed), strip(buildSidebar(FIXTURE, 'test')));
});
