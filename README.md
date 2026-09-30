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

| Rule    | Behaviour                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages   | `.md` files. Anything starting with `_` or `.` is skipped (files and folders).                                                                                          |
| Titles  | `sidebar_label`, then `title`, then the first `# ` heading, then the filename humanised.                                                                                |
| Order   | `sidebar_position` ascending (decimals allowed), then filename. Unpositioned pages come after positioned ones.                                                          |
| Folders | A folder's `README.md` or `index.md` is the folder's own page. Label: `_category_.json`, then that page's title, then the folder name as written. Empty folders vanish. |
| Home    | The root `README.md` is the home page, reached from the site name at the top of the rail, so it is not listed again.                                                    |

`_sidebar.extra.md`, if present, is appended after a divider, verbatim. Use it for links
the folder cannot express, such as other repos' documentation.

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

Sites load `@1`, jsDelivr's "latest 1.x". So:

- **A 1.x release** reaches every site automatically, but not instantly: jsDelivr caches
  what `@1` resolves to, so a release can take hours to appear everywhere. To make it live
  now, purge it:
  `https://purge.jsdelivr.net/gh/acronym-lol/acro-docs-theme@1/theme/acro-docsify.css`
  (and the same for `acro-docsify.js`, `tokens.css`, `fonts.css`).
- **A breaking change** (renamed classes a repo might target, a different shell, a new
  required file) is `2.0.0`. Sites stay on `@1` until each migrates.

To release:

1. Bump `version` in `package.json` and commit.
2. Tag it: `git tag v1.2.0 && git push origin v1.2.0`. jsDelivr's `@1` follows semver tags.
3. Move the floating major tag, which the reusable workflow is called at:
   `git tag -f v1 && git push -f origin v1`.
4. Purge jsDelivr (above) if it needs to be live now.

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
