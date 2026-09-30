import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildSidebar } from './generate.mjs';
import { parseSidebarOrder, resolveLink } from './order.mjs';

/**
 * The author's order, read from the existing _sidebar.md. These mirror the acro-docs tests
 * (scripts/lib/sidebar-order.test.ts), plus what only the generator does: rebuilding the
 * file while keeping the author's order and lines.
 */

function tree(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'acro-order-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

/** The sidebar's list lines, without the generated banner. */
const entries = (out) =>
  out
    .replace(/^<!--[\s\S]*?-->\n\n?/, '')
    .trimEnd()
    .split('\n');

test('every Docsify spelling of a link resolves to the page', () => {
  const pages = new Set(['README.md', 'getting-started.md', 'guides/README.md']);
  for (const t of [
    'getting-started',
    'getting-started.md',
    '/getting-started',
    './getting-started',
    '#/getting-started',
    'getting-started?id=x',
  ]) {
    assert.equal(resolveLink(t, pages), 'getting-started.md', t);
  }
  assert.equal(resolveLink('/', pages), 'README.md');
  assert.equal(resolveLink('guides/', pages), 'guides/README.md');
  assert.equal(resolveLink('https://example.com', pages), null);
});

test('escaped brackets in link text still read as a link', () => {
  const { rank } = parseSidebarOrder('- [Array \\[x\\] syntax](arrays)\n', ['arrays.md']);
  assert.ok(rank.has('arrays.md'));
});

test("rebuilding keeps the author's order, not the alphabet", () => {
  const root = tree({
    'README.md': '# Home',
    'aaa.md': '# Aaa',
    'zeta.md': '# Zeta',
    '_sidebar.md': '- [Home](/)\n- [Zeta](zeta)\n- [Aaa](aaa)\n',
  });
  try {
    assert.deepEqual(entries(buildSidebar(root, 'test')), ['- [Zeta](zeta)', '- [Aaa](aaa)']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('section labels and links to other sites stay where the author put them', () => {
  const root = tree({
    'README.md': '# Home',
    'intro.md': '# Intro',
    'deep.md': '# Deep dive',
    'new.md': '# Brand new',
    '_sidebar.md': [
      '- [Intro](intro)',
      '- **Reference**',
      '- [Deep](deep)',
      '- **Modules**',
      '- [Macros](https://acronym-lol.github.io/acro-td-macros/)',
    ].join('\n'),
  });
  try {
    assert.deepEqual(entries(buildSidebar(root, 'test')), [
      '- [Intro](intro)',
      '- **Reference**',
      '- [Deep dive](deep)',
      // A page the old sidebar did not list joins the pages, before the footer of links.
      '- [Brand new](new)',
      '- **Modules**',
      '- [Macros](https://acronym-lol.github.io/acro-td-macros/)',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a link to a page that no longer exists is dropped; links to other sites are kept', () => {
  const root = tree({
    'README.md': '# Home',
    'kept.md': '# Kept',
    '_sidebar.md':
      '- [Kept](kept)\n- [Deleted](deleted-page)\n- [Elsewhere](https://example.com/)\n',
  });
  try {
    assert.deepEqual(entries(buildSidebar(root, 'test')), [
      '- [Kept](kept)',
      '- [Elsewhere](https://example.com/)',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a bold heading over a folder with no page names it, and the result is stable', () => {
  const root = tree({
    'README.md': '# Home',
    'client-apps/cli.md': '# CLI reference',
    'client-apps/web.md': '# Web SDK',
    '_sidebar.md':
      '- **Client Apps**\n  - [Web](client-apps/web.md)\n  - [CLI](client-apps/cli.md)\n',
  });
  try {
    const first = buildSidebar(root, 'test');
    assert.deepEqual(entries(first), [
      '- **Client Apps**',
      '  - [Web SDK](client-apps/web)',
      '  - [CLI reference](client-apps/cli)',
    ]);
    writeFileSync(path.join(root, '_sidebar.md'), first);
    assert.equal(buildSidebar(root, 'test'), first, 'rebuilding its own output changes nothing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an explicit sidebar_position still wins', () => {
  const root = tree({
    'README.md': '# Home',
    'first.md': '---\nsidebar_position: 1\n---\n# First',
    'second.md': '# Second',
    '_sidebar.md': '- [Second](second)\n- [First](first)\n',
  });
  try {
    assert.deepEqual(entries(buildSidebar(root, 'test')), [
      '- [First](first)',
      '- [Second](second)',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the appended _sidebar.extra.md is not read back as author lines', () => {
  const root = tree({
    'README.md': '# Home',
    'a.md': '# A',
    '_sidebar.extra.md': '- [Elsewhere](https://example.com/)\n',
  });
  try {
    const first = buildSidebar(root, 'test');
    writeFileSync(path.join(root, '_sidebar.md'), first);
    const second = buildSidebar(root, 'test');
    assert.equal(second, first);
    assert.equal(second.split('https://example.com/').length - 1, 1, 'appears once');
    assert.ok(readFileSync(path.join(root, '_sidebar.md'), 'utf8').includes('---'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
