# Migrating a repo to acro-docs-theme

A checklist for moving a repo's Docsify documentation site onto the shared theme and the
generated sidebar. It is written to be followed by an agent without other context. Do the
steps in order, and do not skip the verification.

**One repo per pull request.** Do not batch repos.

## 0. Check it applies

The repo qualifies if **all** of these are true. If any is false, stop and report back.

- It has `docs/index.html` that loads Docsify (`cdn.jsdelivr.net/npm/docsify`).
- GitHub Pages publishes the `docs/` folder (Settings → Pages, or
  `gh api repos/acronym-lol/<repo>/pages`).
- `docs/.nojekyll` exists. If it does not, the site does not currently serve
  `_sidebar.md`, so check how it works today before changing anything.

Note which branch Pages builds from (`source.branch`). Some repos publish from `dev`, not
`main`. Make the pull request against **that** branch.

## 1. Replace `docs/index.html` with the shell

Copy [`templates/index.html`](templates/index.html) over `docs/index.html`, and fill in:

- `REPO NAME` (twice): the value of `window.$docsify.name` in the old file. If the old
  file has none, use `name` from `docs/_meta.yml`.
- `REPO-SLUG`: the repo's name, e.g. `acro-td-core`. Check the link: some old files still
  point at the `vtprodesign-inc` organisation. The shell must say `acronym-lol`.

Then look at the old file for anything **beyond** the shared defaults:

| In the old file                                                        | What to do                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Inline `<style>` (colours, table fixes, sidebar tweaks)                | Drop it. The theme covers it.                                                                                |
| `docsify@4`, `search`, `docsify-copy-code`, Prism language `<script>`s | Drop them. The theme loads them at pinned versions.                                                          |
| A Prism language not in the theme's list (see README)                  | Keep it by adding `acro: { prism: ['lua'] }` to `window.$docsify`.                                           |
| `loadSidebar`, `subMaxLevel`, `auto2top`, `search: {...}`              | Drop them; the theme sets them.                                                                              |
| `coverpage: true`, `loadNavbar`, `alias`, or another plugin            | Keep the setting in `window.$docsify` (and the plugin's `<script>` after the theme's). Mention it in the PR. |
| Anything else you cannot classify                                      | Keep it, and flag it in the PR description.                                                                  |

Keep `docs/.nojekyll`. Do not touch `docs/_meta.yml`.

## 2. Leave the existing sidebar alone

**Do not rewrite or reorder `docs/_sidebar.md`.** The generator reads it as the author's
order and rebuilds from it:

- **Order** is kept as written. Pages it does not list are added after the ones it does,
  and links to pages that no longer exist are dropped.
- **Titles** are taken from the pages themselves (their first `# Heading`, or `title`),
  the same as on acro-docs, so a label that differs from its page's heading will change.
  That is expected; mention it in the PR if a title looks wrong.
- **Top-level lines that are not page links** are kept as written, in place: flat section
  labels like `- **Reference**`, and links to other sites.
- **A bold heading with pages nested under it** that all live in one folder with no
  README of its own becomes that folder's name (e.g. `**Client Apps**` over
  `client-apps/`).

Two things to check in the old sidebar:

- **Links to GitHub folders** (`https://github.com/acronym-lol/<repo>/tree/...`): these
  sites are public, and those links 404 for anyone outside the organisation. If the target
  has its own Pages site, change the link to that. Otherwise leave it.
- **Nested links to other sites** (indented under a heading): only top-level non-page
  lines are kept. Move any nested external links to the top level, or into
  `docs/_sidebar.extra.md`, which is appended after a divider.

Do not add `sidebar_position` to pages just to keep the old order. The sidebar already
carries it, and acro-docs reads the same file.

## 3. Add the sidebar workflow

Copy [`templates/acro-docs-sidebar.yml`](templates/acro-docs-sidebar.yml) to
`.github/workflows/acro-docs-sidebar.yml`, unchanged.

**If the repo hosts more than one site** (for example one per git subtree, as acro-td-core
does), list every folder in `docs-paths` and widen `paths:` to match; see "Several sites in
one repo" in the README. **If the repo is itself a subtree published from another repo, add
no workflow to it**: generate in the parent instead, or the parent's next subtree push is
rejected. Steps 1, 2 and 4 still apply to each folder.

## 4. Generate the sidebar once

From the repo root:

```sh
npx -p github:acronym-lol/acro-docs-theme#v1 acro-docs-sidebar docs
```

It rebuilds `docs/_sidebar.md` in place, keeping its order and section labels. Check the
diff: it should be the same pages in the same order, with titles taken from the pages and
a generated note at the top. Commit it: the workflow keeps it current from now on.

## 5. Callouts

If pages use Docsify's own helpers, convert them to GitHub's syntax, which the theme
styles and github.com also renders:

| Docsify   | Becomes                      |
| --------- | ---------------------------- |
| `!> text` | `> [!WARNING]` then `> text` |
| `?> text` | `> [!TIP]` then `> text`     |

Leave any other content alone.

## 6. Verify locally

Serve the folder and open it in a browser:

```sh
python -m http.server 8000 -d docs    # or: npx serve docs
```

Check, and say in the PR that you checked:

- [ ] The page renders with the Acronym look, and the browser console shows no errors.
- [ ] The sidebar lists every page, in a sensible order, with correct titles. Folders
      open and close, and the current page is highlighted.
- [ ] Links in `_sidebar.extra.md` appear after the divider.
- [ ] Search finds a word from a page other than the home page.
- [ ] A code block has a Copy button, and highlighting looks right.
- [ ] The header shows the repo name, summary and "Source on GitHub".
- [ ] The toggle at the foot of the rail switches light and dark.
- [ ] At phone width (about 400px), the menu button opens and closes the sidebar.
- [ ] No front matter (`---`, `last_reviewed:`) shows on any page.

## 7. Open the pull request

Against the branch Pages builds from. Title: `Move docs site to acro-docs-theme`. Body:

```md
Moves the GitHub Pages docs site onto the shared acro-docs-theme
(https://github.com/acronym-lol/acro-docs-theme): the shell index.html, the generated
sidebar, and the workflow that keeps it current.

- index.html: now the shell. Kept from the old file: <anything kept, or "nothing">.
- Sidebar: rebuilt in place, order kept. Titles that changed: <list, or "none">.
- Callouts converted: <count, or "none">.

Verified locally: <the checklist above>.
```

After it merges, open the Pages site and confirm it looks the same as it did locally.
jsDelivr may take a few minutes to serve the theme the first time.

## Do not

- Edit `_sidebar.md` by hand. It is overwritten on the next push.
- Copy the theme's CSS or JS into the repo. The point is that nothing is copied.
- Change page content beyond `sidebar_position` and callout syntax.
- Rename or move pages.
- Touch `docs/_meta.yml`. It belongs to acro-docs.
