# geocultur.de

Static website for Prof. Dr. Heinz Schürmann.

## Layout

- `index.html` — home page
- `aktuelles/index.html` — news page
- `programm/index.html` — current programme and travel partners
- `download/index.html` — legacy redirect to `/programm/`
- `impressum/index.html` — imprint, contact, and webmaster details
- `assets/css/site.css` — responsive presentation and accessibility styles
- `assets/images/` — optimized site and partner images
- `documents/programmes/` — current and archived programme downloads
- `documents/travel/` — destination PDFs
- `documents/notices/` — standalone notices
- `source/` — high-resolution and editable source artwork
- `archive/` — superseded site copies, the former JavaScript theme, backups, and unused assets
- root-level redirect HTML files and retired travel routes — compatibility redirects for old public URLs

## CDN paths

The CDN mirrors this repository's relative file paths. A local file such as
`assets/images/site/logo.png` is therefore available at:

`https://geoculturde.cdn.tiekoetter.cloud/assets/images/site/logo.png`

When moving a file used by the website, update its CDN URL to the same relative
path.

Run `node scripts/validate-paths.mjs` after changing paths. It checks that every
active CDN URL, page link, redirect, and in-page link has a matching target. It
also verifies the heading, language, image, ARIA, and current-navigation basics
for all public pages and ensures they remain free of JavaScript and inline event
handlers.

## Automated programme deployment

Add each new programme as
`documents/programmes/Reisen-aktuell-YYYY-MM.pdf`. On every push to `main`, the
GitHub Pages workflow selects the newest year and month, verifies that it is a
non-empty PDF, updates the programme link and its issue/size metadata in the
generated site, validates the result, and deploys it. No JavaScript is added to
the public pages and generated files are not committed back to the repository.

Run the same build locally with `node scripts/build-site.mjs`. The generated
site is written to `_site/` and can be checked with
`node scripts/validate-paths.mjs _site`.

After committing the workflow, choose **GitHub Actions** once under
**Settings → Pages → Build and deployment → Source**. The existing custom domain
and `CNAME` remain unchanged.

## GitHub Pages mirror

The repository is prepared for branch-based GitHub Pages publishing at
`https://geoculturde.cdn.tiekoetter.cloud/`:

- `CNAME` declares the custom Pages hostname.
- `.nojekyll` keeps the repository as an exact static-file tree.
- All active asset URLs use the custom hostname and the same repository-relative
  path.

Configure Pages to deploy `main` from `/(root)`. In DNS, create this record:

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `geoculturde.cdn` | `tiekoettercomhosted.github.io` |

Add `geoculturde.cdn.tiekoetter.cloud` as the custom domain in the repository's
Pages settings before creating the DNS record, then enable **Enforce HTTPS** once
GitHub has provisioned the certificate.

### Safe rollout order

If `geocultur.de` deploys automatically from `main`, avoid temporarily breaking
its assets by activating the mirror first:

1. Commit and push only `CNAME` and `.nojekyll`.
2. Enable Pages from `main` and `/(root)`, then set the custom domain.
3. Create the DNS record above and wait for HTTPS to become available.
4. Confirm that `https://geoculturde.cdn.tiekoetter.cloud/` and one asset path
   load successfully.
5. Commit and deploy the remaining URL changes.

## Accessibility

The public pages use semantic HTML and do not require JavaScript. They include
skip links, landmarks, logical heading structures, visible keyboard focus,
large interaction targets, responsive reflow, reduced-motion support,
descriptive image text, and a native `details` element for the expandable
profile.
