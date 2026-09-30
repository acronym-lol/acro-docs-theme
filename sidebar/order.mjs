/**
 * Reads the page order a repo's authors wrote into its Docsify `docs/_sidebar.md`.
 *
 * MIRRORS acronym-lol/acro-docs scripts/lib/sidebar-order.ts. The two must agree: acro-docs
 * orders a repo's pages by the same file, and a page should sit in the same place on the
 * repo's Pages site as on acro-docs. Change them together.
 *
 * Why this file is the order source: when this was written, none of the 14 repos on
 * acro-docs set `sidebar_position` on any page, but all 14 kept a hand-written
 * `_sidebar.md`, 13 of them listing every page. The order is already there.
 *
 *   rank          page -> line of its first link (document order)
 *   folderLabels  folder -> a bold heading's text, when every page nested under that
 *                 heading lives in that folder (vt-vtsp-megarepo's `**Client Apps**`)
 *   items         every list line, classified, so the generator can keep the lines that
 *                 are not page links (flat section labels, external links)
 */

const LIST_ITEM = /^(\s*)[-*+]\s+(.*?)\s*$/;
// Link text may contain escaped brackets (`[Array \[x\] syntax](arrays)`); the generator
// writes them that way, so they must read back as a link.
const LINK = /\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/;
const BOLD_LABEL = /^(?:\*\*|__)(.+?)(?:\*\*|__)$/;

/**
 * The page a sidebar link points at, or null. Docsify accepts `page`, `page.md`, `/page`,
 * `./page`, `#/page`, `folder/` for a folder's README, and `/` for the home page.
 */
export function resolveLink(target, pages) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return null;
  let t = target.replace(/^#\//, '').split('#')[0].split('?')[0];
  t = t.replace(/^\.\//, '').replace(/^\/+/, '');
  try {
    t = decodeURIComponent(t);
  } catch {
    // A malformed escape is left as written; it will simply not match a page.
  }
  const candidates =
    t === '' ? ['README.md', 'index.md'] : [t, `${t}.md`, `${t.replace(/\/+$/, '')}/README.md`];
  for (const c of candidates) if (pages.has(c)) return c;
  const lower = new Map([...pages].map((p) => [p.toLowerCase(), p]));
  for (const c of candidates) {
    const hit = lower.get(c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function depthOf(indent) {
  return Math.floor(indent.replace(/\t/g, '    ').length / 2);
}

function dirOf(page) {
  const i = page.lastIndexOf('/');
  return i === -1 ? '' : page.slice(0, i);
}

function commonDir(pages) {
  let parts = dirOf(pages[0]).split('/').filter(Boolean);
  for (const p of pages.slice(1)) {
    const other = dirOf(p).split('/').filter(Boolean);
    let n = 0;
    while (n < parts.length && n < other.length && parts[n] === other[n]) n++;
    parts = parts.slice(0, n);
  }
  return parts.join('/');
}

export function parseSidebarOrder(text, pagesList) {
  const pages = new Set(pagesList);
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const items = [];
  const rank = new Map();

  lines.forEach((raw, line) => {
    const m = LIST_ITEM.exec(raw);
    if (!m) return;
    const depth = depthOf(m[1]);
    const body = m[2];
    const link = LINK.exec(body);
    if (link) {
      const page = resolveLink(link[2], pages);
      if (page) {
        items.push({ line, depth, kind: 'page', page, raw });
        if (!rank.has(page)) rank.set(page, line);
      } else {
        // A link to another site is kept; a relative link that matches no page is a page
        // that has gone (renamed or deleted), and is dropped from the rebuilt sidebar.
        const external = /^[a-z][a-z0-9+.-]*:/i.test(link[2]) || link[2].startsWith('//');
        items.push({ line, depth, kind: external ? 'extra' : 'stale', raw });
      }
      return;
    }
    const bold = BOLD_LABEL.exec(body);
    if (bold) items.push({ line, depth, kind: 'label', label: bold[1].trim(), raw });
    else items.push({ line, depth, kind: 'extra', raw });
  });

  const folderLabels = new Map();
  items.forEach((item, i) => {
    // Whether anything is nested under this line: a heading with children is structure,
    // not a stand-alone section label (the generator keeps only the latter verbatim).
    item.nested = i + 1 < items.length && items[i + 1].depth > item.depth;
    if (item.kind !== 'label') return;
    const nested = [];
    for (let j = i + 1; j < items.length && items[j].depth > item.depth; j++) {
      if (items[j].kind === 'page') nested.push(items[j].page);
    }
    if (nested.length === 0) return;
    const dir = commonDir(nested);
    if (dir && !folderLabels.has(dir)) folderLabels.set(dir, item.label);
  });

  return { rank, folderLabels, items };
}

/** A folder's rank: its earliest listed page's. Undefined when nothing in it is listed. */
export function folderRank(dir, rank) {
  let best;
  for (const [page, r] of rank) {
    if (page.startsWith(`${dir}/`) && (best === undefined || r < best)) best = r;
  }
  return best;
}
