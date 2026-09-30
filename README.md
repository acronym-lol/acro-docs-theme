# acro-docs-theme

The Acronym look for repos that publish their `docs/` folder as a public
[GitHub Pages](https://pages.github.com/) site with [Docsify](https://docsify.js.org/), and
a sidebar generated from that folder with the same rules as the internal acro-docs site.

- **One theme, loaded by URL.** A repo's `docs/index.html` is a short shell that loads
  `theme/acro-docsify.css` and `theme/acro-docsify.js` from jsDelivr at `@1`. Styling
  changes reach every site on the next release. Nothing is copied into repos, so nothing
  drifts.
- **One source for the brand.** Colours, fonts and syntax colours come from acro-docs
  (`theme/tokens.css` is generated there), so a brand change lands on acro-docs and on
  every Pages site together.
- **A sidebar nobody maintains.** `_sidebar.md` is generated from the `docs/` folder by a
  reusable workflow on every push. A page sits in the same place, with the same title, as
  on acro-docs.

**Migrating a repo?** Follow [MIGRATING.md](MIGRATING.md). It is written to be handed to an
agent as-is.

## What a repo ends up with

```
docs/
  index.html          the shell: name, repo link, two tags (templates/index.html)
  .nojekyll           so GitHub Pages serves the _-prefixed files below
  _sidebar.md         GENERATED; never edit by hand
  _sidebar.extra.md   optional: extra links appended to the sidebar
  _meta.yml           the repo's acro-docs metadata (name and summary feed the page header)
  README.md           the home page
  ...                 the rest of the documentation
.github/workflows/acro-docs-sidebar.yml   (templates/acro-docs-sidebar.yml)
```

## The sidebar

`sidebar/generate.mjs` turns `docs/` into `_sidebar.md` with the acro-docs rules
(`scripts/lib/nav.ts` there, plus its ingestion rules):

| Rule    | Behaviour                                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages   | `.md` files. Anything starting with `_` or `.` is skipped (files and folders).                                                                                                                                                                                      |
| Titles  | `sidebar_label`, then `title`, then the first `# ` heading, then the filename humanised.                                                                                                                                                                            |
| Order   | `sidebar_position` if a page sets one; otherwise the page's place in the existing `_sidebar.md` (the author's order); otherwise filename, after the listed pages.                                                                                                   |
| Folders | A folder's `README.md` or `index.md` is the folder's own page. Label: `_category_.json`, then (for a folder with no page of its own) a bold heading over its pages in `_sidebar.md`, then that page's title, then the folder name as written. Empty folders vanish. |
| Home    | The root `README.md` is the home page, reached from the site name at the top of the rail, so it is not listed again.                                                                                                                                                |

**The existing `_sidebar.md` is the order.** Every run rebuilds it from itself: the order
of its lines is kept, pages it does not list are added after the listed ones, links to
pages that have gone are dropped, and titles are taken from the pages. Top-level lines that
are not page links (a flat `- **Reference**` label, a link to another site) stay where the
author put them. So to reorder a site, move lines in `_sidebar.md`; the next run keeps it.
Rebuilding its own output changes nothing, and acro-docs reads the same file for the same
order (`scripts/lib/sidebar-order.ts` there mirrors `sidebar/order.mjs` here).

`_sidebar.extra.md`, if present, is appended after a divider, verbatim, for links that
belong below everything else.

Run it by hand with:

```sh
npx -p github:acronym-lol/acro-docs-theme#v1 acro-docs-sidebar docs          # write
npx -p github:acronym-lol/acro-docs-theme#v1 acro-docs-sidebar docs --check  # exit 1 if stale
```

The reusable workflow (`.github/workflows/sidebar.yml`) runs the same command on pushes
that touch `docs/`, and commits the result as `github-actions[bot]`. It cannot push to a
branch that blocks bot pushes; it then fails with a message saying to run the command
above locally.

### Several sites in one repo

A repo that hosts more than one docs site (acro-td-core has its own plus one per module,
each published from a git subtree) regenerates them all in one run. The command takes
several folders:

```sh
npx -p github:acronym-lol/acro-docs-theme#v1 acro-docs-sidebar docs modules/acro-td-macros/docs
```

and the workflow takes `docs-paths`, one folder per line, instead of `docs-path`:

```yaml
jobs:
  sidebar:
    uses: acronym-lol/acro-docs-theme/.github/workflows/sidebar.yml@v1
    with:
      docs-paths: |
        docs
        modules/acro-td-macros/docs
```

Every changed sidebar goes into one commit. Calling the workflow once per folder instead
would not work: each run pushes on its own, and all but the first are rejected. Also widen
the workflow's `paths:` trigger to cover every folder.

> [!WARNING]
> If a folder is published as a **git subtree** into its own repo, do not add the workflow
> to that repo. Its bot commit would exist only there, and the next `git subtree push` from
> the parent would be rejected. Generate in the parent repo only; the subtree push carries
> the sidebar out.

## Writing for it

Plain CommonMark, the same as for acro-docs. A few extras:

- **Callouts** use GitHub's syntax, so the source renders on github.com too:

  ```md
  > [!WARNING]
  > Restart TouchDesigner after changing this.
  ```

  Types: `NOTE`, `TIP`, `INFO`, `IMPORTANT`, `WARNING`, `CAUTION`, `DANGER`.

- **Front matter** (`title`, `sidebar_position`, `last_reviewed`...) is stripped before a
  page renders, so the fields acro-docs uses do not appear on the Pages site.
- **Code blocks** highlight Python, Bash, JSON, YAML, TypeScript, JavaScript, PowerShell,
  C, GLSL, Markdown and INI. A repo can add more with
  `acro: { prism: ['lua'] }` in its `window.$docsify`.
- **The page header** shows the repo's `name` and `summary` from `docs/_meta.yml`, and a
  link to the source. It deliberately leaves out status, tier and owner: these sites are
  public, and those fields are internal.

Light and dark follow the reader's OS, with a toggle in the rail's top row (beside the
site name and the collapse button) that is remembered per browser.

**On this page:** on screens at least 1200px wide, pages with two or more `##`/`###`
headings get a contents column on the right, as on acro-docs, with the section being read
highlighted as the reader scrolls.

## Versions and releases

Sites load `@1`, which jsDelivr resolves to the highest `v1.x.y` **tag**. So:

- **A 1.x release** reaches every site automatically, but not instantly. jsDelivr's CDN
  re-checks what `@1` means every 12 hours; purge to make it immediate:
  `https://purge.jsdelivr.net/gh/acronym-lol/acro-docs-theme@1/theme/acro-docsify.css`
  (and the same for `acro-docsify.js`, `tokens.css`, `fonts.css`). Readers' **browsers**
  may keep the previous copy for up to 7 days (jsDelivr's `max-age` for version ranges),
  and no purge reaches those, so a small change can take a week to reach everyone.
- **A breaking change** (renamed classes a repo might target, a different shell, a new
  required file) is `2.0.0`. Sites stay on `@1` until each migrates.

> [!WARNING]
> **`v1` is a branch, never a tag.** jsDelivr treats a tag named `v1` as the exact,
> permanent version "1": it caches that tag's files forever (`immutable`), ignores later
> moves of the tag, and cannot be purged. `@1` then never picks up a release. This
> happened with 1.1.0 and 1.2.0 until the tag was replaced by a branch. The reusable
> workflow's `@v1` works the same with a branch.

To release:

1. Bump `version` in `package.json` and commit to `main`.
2. Tag the release: `git tag -a v1.3.0 -m "acro-docs-theme 1.3.0" && git push origin v1.3.0`.
   This is what `@1` on jsDelivr follows.
3. Fast-forward the `v1` **branch**, which the reusable workflow and
   `npx -p github:acronym-lol/acro-docs-theme#v1` use:
   `git push origin main:v1`.
4. Purge jsDelivr (above) if it needs to be live now, then check the version it serves:
   `curl -sI https://cdn.jsdelivr.net/gh/acronym-lol/acro-docs-theme@1/theme/acro-docsify.js | grep -i x-jsd-version`.

Docsify, docsify-copy-code and Prism are pinned in `theme/acro-docsify.js` (`VERSIONS`).
Upgrading them is a theme release, not a pull request per repo.

## Where the colours come from

`theme/tokens.css` is **generated** by acro-docs from its `src/css/custom.css` and
`scripts/lib/prism-themes.ts`. Never edit it here. To update it:

```sh
# in an acro-docs checkout, next to this one
pnpm theme:tokens ../acro-docs-theme
```

then commit it here and release. `theme/acro-docsify.css` refers only to the role names in
that file (`--acro-bg`, `--acro-primary`, `--acro-syntax-keyword`...), never to hex values.

The fonts in `theme/fonts/` are the open-licence (OFL) brand faces acro-docs serves. The
licensed brand faces are not included: their web-embedding rights are unconfirmed.

## Developing the theme

```sh
npm test                                  # generator tests
npm run check                             # tests + fixture sidebars are current
python -m http.server 3920                # then open http://127.0.0.1:3920/fixtures/site/
```

`fixtures/site/` is a small Docsify site that loads the theme from this checkout and uses
every element (callouts, code, tables, folders), so changes can be judged without a real
repo. `fixtures/docs/` exercises every sidebar rule. If you change a rule, regenerate both
(`node bin/acro-docs-sidebar.mjs fixtures/docs`, likewise `fixtures/site`) and commit the
diff.

`preview/` is gitignored, for trying the theme on a real repo's `docs/` locally.
