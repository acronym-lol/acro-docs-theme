/*
 * acro-docs-theme: loader, defaults and plugins for Acronym's Docsify documentation sites.
 *
 * A repo's docs/index.html sets `window.$docsify = { name, repo }` and then loads this
 * script (a plain <script>, not async or defer) after <div id="app">, in <body>: Docsify
 * reads document.body the moment it loads, so it cannot start from <head>. This file:
 *
 *   1. applies a light or dark mode the reader chose (with no choice, tokens.css follows
 *      the OS on its own, so there is no flash before this runs);
 *   2. merges the shared defaults under the repo's own settings (the repo wins);
 *   3. loads Docsify and its plugins at versions pinned HERE, so upgrading Docsify is a
 *      theme release rather than a pull request per repo;
 *   4. adds the Acronym plugins: the page header, callouts, the sidebar behaviour and the
 *      theme toggle.
 *
 * Nothing here is repo-specific. A repo that needs more sets it on window.$docsify, or
 * adds Prism languages with `acro: { prism: ['lua'] }`.
 */
(function () {
  'use strict';

  var VERSIONS = { docsify: '4.13.1', copyCode: '2.1.1', prism: '1.29.0' };
  var NPM = 'https://cdn.jsdelivr.net/npm/';
  // Beyond the ones Docsify bundles (markup, css, clike, javascript). ORDER MATTERS: a
  // grammar that extends another must come after it (glsl extends c).
  var PRISM_LANGUAGES = [
    'python',
    'bash',
    'json',
    'yaml',
    'typescript',
    'powershell',
    'c',
    'glsl',
    'markdown',
    'ini',
  ];

  // ------------------------------------------------------------ 1. light or dark

  var STORE = 'acro-docs-theme:mode';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedMode() {
    try {
      var m = window.localStorage.getItem(STORE);
      return m === 'dark' || m === 'light' ? m : null;
    } catch (e) {
      // Storage can be unavailable (private windows, blocked site data). Follow the OS.
      return null;
    }
  }
  function systemMode() {
    return media && media.matches ? 'dark' : 'light';
  }
  function applyMode(mode) {
    root.setAttribute('data-theme', mode);
  }
  /** The mode on screen: the reader's choice if they made one, otherwise the OS's. */
  function currentMode() {
    return root.getAttribute('data-theme') || systemMode();
  }
  // Only an explicit choice is applied. Without one, data-theme stays unset and the
  // prefers-color-scheme rules in tokens.css follow the OS, including live changes.
  var chosen = storedMode();
  if (chosen) applyMode(chosen);

  // ------------------------------------------------------------ 2. configuration

  var repo = window.$docsify || {};

  var defaults = {
    loadSidebar: true,
    // Every folder's route uses the one generated sidebar at the docs root. Without this,
    // Docsify first requests `<folder>/_sidebar.md` for each page in a folder, which
    // 404s on every navigation.
    alias: { '/.*/_sidebar.md': '/_sidebar.md' },
    // Headings belong in the page; the rail lists pages, as on acro-docs.
    subMaxLevel: 0,
    maxLevel: 4,
    auto2top: true,
    relativePath: false,
    search: {
      placeholder: 'Search',
      noData: 'No results.',
      depth: 6,
    },
    copyCode: {
      buttonText: 'Copy',
      errorText: 'Error',
      successText: 'Copied',
    },
  };

  var config = {};
  var key;
  for (key in defaults) config[key] = defaults[key];
  for (key in repo) config[key] = repo[key];
  config.search = merge(defaults.search, repo.search);
  config.copyCode = merge(defaults.copyCode, repo.copyCode);
  config.alias = merge(defaults.alias, repo.alias);
  config.plugins = [
    frontmatterPlugin,
    headerPlugin,
    calloutPlugin,
    sidebarPlugin,
    togglePlugin,
  ].concat(
    repo.plugins || [],
  );
  window.$docsify = config;

  function merge(a, b) {
    var out = {};
    var k;
    for (k in a || {}) out[k] = a[k];
    for (k in b || {}) out[k] = b[k];
    return out;
  }

  // ------------------------------------------------------------ 3. load Docsify

  var extraLanguages = (repo.acro && repo.acro.prism) || [];
  var scripts = [NPM + 'docsify@' + VERSIONS.docsify + '/lib/docsify.min.js']
    .concat([NPM + 'docsify@' + VERSIONS.docsify + '/lib/plugins/search.min.js'])
    .concat([NPM + 'docsify-copy-code@' + VERSIONS.copyCode + '/dist/docsify-copy-code.min.js'])
    .concat(
      PRISM_LANGUAGES.concat(extraLanguages).map(function (lang) {
        return NPM + 'prismjs@' + VERSIONS.prism + '/components/prism-' + lang + '.min.js';
      }),
    );

  if (document.readyState === 'loading') {
    // Parser-inserted scripts run in order and before DOMContentLoaded, which is what
    // Docsify needs: it starts as soon as it loads, so the plugins and languages must
    // already be registered by the time the page is ready. Dynamically added scripts
    // guarantee neither.
    document.write(
      scripts
        .map(function (src) {
          return '<script src="' + src + '"><\/script>';
        })
        .join(''),
    );
  } else {
    // Loaded late (async, defer, or injected), where document.write would wipe the page.
    // Load one after another instead. Plugins registered after Docsify starts can miss the
    // first render, so say how to fix it.
    console.warn(
      'acro-docs-theme: load acro-docsify.js as a plain <script> after <div id="app">, not async or defer.',
    );
    (function next(i) {
      if (i >= scripts.length) return;
      var s = document.createElement('script');
      s.src = scripts[i];
      s.onload = function () {
        next(i + 1);
      };
      document.body.appendChild(s);
    })(0);
  }

  // ------------------------------------------------------------ 4. plugins

  /**
   * Front matter is for acro-docs (titles, sidebar_position, last_reviewed), and Docsify
   * does not understand it: it renders the block as a divider and a heading. Strip it
   * before the markdown is rendered. A UTF-8 BOM and CRLF endings are tolerated, as in the
   * sidebar generator.
   */
  var FRONTMATTER = /^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

  function frontmatterPlugin(hook) {
    hook.beforeEach(function (markdown) {
      return markdown.replace(FRONTMATTER, '');
    });
  }

  /**
   * The header above each page: the repo's name and summary from docs/_meta.yml, and a
   * link to the source. Public facts only. Status, tier and owner are on the internal
   * acro-docs site and stay there.
   */
  function headerPlugin(hook, vm) {
    var meta = null;
    var ready = fetch(new URL('_meta.yml', location.href.split('#')[0]).href, { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.text() : '';
      })
      .then(function (text) {
        meta = readMeta(text);
      })
      .catch(function () {
        meta = {};
      });

    hook.doneEach(function () {
      ready.then(function () {
        var section = document.querySelector('.markdown-section');
        if (!section || section.querySelector('.acro-header')) return;
        var name = meta.name || vm.config.name;
        var repoUrl = typeof vm.config.repo === 'string' ? vm.config.repo : '';
        if (!name && !repoUrl) return;

        var header = el('div', 'acro-header');
        if (name) header.appendChild(el('span', 'acro-header-name', stripTags(name)));
        if (repoUrl) {
          var a = el('a', 'acro-header-source', 'Source on GitHub ↗');
          a.href = repoUrl.indexOf('http') === 0 ? repoUrl : 'https://github.com/' + repoUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          header.appendChild(a);
        }
        if (meta.summary) header.appendChild(el('p', 'acro-header-summary', meta.summary));
        section.insertBefore(header, section.firstChild);
      });
    });
  }

  /**
   * The two keys the header needs, read from _meta.yml without a YAML library. Handles
   * plain and quoted scalars and a folded `>` or `|` block; anything else is ignored.
   */
  function readMeta(text) {
    var out = {};
    var lines = text.replace(/\r\n/g, '\n').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = /^(name|summary):[ \t]*(.*?)[ \t]*$/.exec(lines[i]);
      if (!m) continue;
      var value = m[2];
      if (value === '>' || value === '|' || value === '>-' || value === '|-') {
        var block = [];
        while (i + 1 < lines.length && /^[ \t]+\S/.test(lines[i + 1]))
          block.push(lines[++i].trim());
        value = block.join(value.charAt(0) === '>' ? ' ' : '\n');
      } else if (/^".*"$/.test(value)) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      } else if (/^'.*'$/.test(value)) {
        value = value.slice(1, -1).replace(/''/g, "'");
      } else {
        value = value.replace(/\s+#.*$/, '');
      }
      out[m[1]] = value;
    }
    return out;
  }

  /**
   * GitHub's alert syntax, `> [!NOTE]` on the first line of a quote, becomes an Acronym
   * callout. GitHub renders the same source as its own alert, so the markdown reads well
   * in both places.
   */
  var CALLOUT_TITLES = {
    note: 'Note',
    tip: 'Tip',
    info: 'Info',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
    danger: 'Danger',
  };

  function calloutPlugin(hook) {
    hook.doneEach(function () {
      var quotes = document.querySelectorAll('.markdown-section blockquote');
      for (var i = 0; i < quotes.length; i++) {
        var quote = quotes[i];
        var first = quote.firstElementChild;
        if (!first || first.tagName !== 'P') continue;
        var m = /^\s*\[!(\w+)\]/.exec(first.textContent);
        if (!m) continue;
        var type = m[1].toLowerCase();
        if (!CALLOUT_TITLES[type]) continue;

        stripMarker(first);
        var box = el('div', 'acro-callout acro-callout--' + type);
        box.setAttribute(
          'role',
          type === 'warning' || type === 'danger' || type === 'caution' ? 'alert' : 'note',
        );
        box.appendChild(el('p', 'acro-callout-title', CALLOUT_TITLES[type]));
        while (quote.firstChild) box.appendChild(quote.firstChild);
        if (first.textContent.trim() === '' && !first.querySelector('img')) first.remove();
        quote.replaceWith(box);
      }
    });
  }

  /** Removes `[!TYPE]` and the line break after it from the start of a paragraph. */
  function stripMarker(p) {
    var node = p.firstChild;
    while (node && node.nodeType === 3 && !/\S/.test(node.nodeValue)) node = node.nextSibling;
    if (!node || node.nodeType !== 3) return;
    node.nodeValue = node.nodeValue.replace(/^\s*\[!\w+\]\s*/, '');
    var next = node.nextSibling;
    if (node.nodeValue === '' && next && next.nodeName === 'BR') next.remove();
  }

  /**
   * The sidebar, made to behave like the acro-docs rail: folders get a caret and a page
   * count and collapse, the folder holding the current page opens, and a folder someone
   * opened by hand stays open as they move around.
   */
  var opened = {};

  function sidebarPlugin(hook) {
    hook.doneEach(function () {
      var nav = document.querySelector('.sidebar-nav');
      if (!nav) return;

      var items = nav.querySelectorAll('li');
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var sub = directChild(li, 'UL');
        if (!sub || sub.classList.contains('app-sub-sidebar')) continue;
        if (!li.classList.contains('acro-folder')) enhanceFolder(li, sub);
      }

      // Open the folders on the path to the current page; leave the rest as they were.
      var folders = nav.querySelectorAll('li.acro-folder');
      for (var j = 0; j < folders.length; j++) {
        var f = folders[j];
        var onPath = f.classList.contains('active') || !!f.querySelector('li.active');
        var keep = opened[f.getAttribute('data-acro-key')];
        f.classList.toggle('acro-collapsed', !(onPath || keep));
        var caret = f.querySelector(':scope > .acro-folder-row > .acro-caret');
        if (caret)
          caret.setAttribute('aria-expanded', String(!f.classList.contains('acro-collapsed')));
      }
    });
  }

  function enhanceFolder(li, sub) {
    li.classList.add('acro-folder');
    var row = el('div', 'acro-folder-row');

    // Everything before the nested list is the folder's label: its own link if the folder
    // has a page, otherwise the bold group name the generator writes.
    var head = [];
    for (var n = li.firstChild; n && n !== sub; n = n.nextSibling) head.push(n);
    var link = null;
    for (var i = 0; i < head.length; i++) {
      var node = head[i].nodeName === 'P' ? head[i].querySelector('a') || head[i] : head[i];
      if (node.nodeName === 'A') link = node;
    }
    if (link) {
      row.appendChild(link);
    } else {
      var label = el('span', 'acro-folder-label');
      for (var k = 0; k < head.length; k++) label.appendChild(head[k]);
      row.appendChild(label);
    }
    head.forEach(function (h) {
      if (h.parentNode === li) h.remove();
    });

    var labelText = (link || row.firstChild).textContent.trim();
    li.setAttribute('data-acro-key', labelText);

    var count = sub.querySelectorAll('a').length;
    if (count) row.appendChild(el('span', 'acro-count', String(count)));

    var caret = el('button', 'acro-caret');
    caret.type = 'button';
    caret.setAttribute('aria-label', 'Show or hide ' + labelText);
    caret.addEventListener('click', function () {
      var nowCollapsed = !li.classList.contains('acro-collapsed');
      li.classList.toggle('acro-collapsed', nowCollapsed);
      opened[labelText] = !nowCollapsed;
      caret.setAttribute('aria-expanded', String(!nowCollapsed));
    });
    // A folder with no page of its own: clicking its name toggles it too.
    if (!link)
      row.firstChild.addEventListener('click', function () {
        caret.click();
      });
    row.appendChild(caret);

    li.insertBefore(row, sub);
  }

  /** A light/dark switch at the foot of the rail. The choice is remembered per browser. */
  function togglePlugin(hook) {
    hook.doneEach(function () {
      var sidebar = document.querySelector('.sidebar');
      if (!sidebar || sidebar.querySelector('.acro-theme-toggle')) return;
      var wrap = el('div', 'acro-theme-toggle');
      var button = el('button', '');
      button.type = 'button';
      var label = function () {
        button.textContent = currentMode() === 'dark' ? 'Light mode' : 'Dark mode';
      };
      label();
      button.addEventListener('click', function () {
        var next = currentMode() === 'dark' ? 'light' : 'dark';
        applyMode(next);
        try {
          window.localStorage.setItem(STORE, next);
        } catch (e) {
          // Not remembered, but it still switches for this visit.
        }
        label();
      });
      wrap.appendChild(button);
      sidebar.appendChild(wrap);
    });
  }

  // ------------------------------------------------------------ helpers

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function directChild(parent, tagName) {
    for (var c = parent.firstElementChild; c; c = c.nextElementSibling)
      if (c.tagName === tagName) return c;
    return null;
  }

  function stripTags(s) {
    return String(s).replace(/<[^>]*>/g, '');
  }
})();
