# geocultur.de

Static website for Prof. Dr. Heinz Schürmann.

## Layout

- `index.html` — complete, semantic public website
- `assets/css/site.css` — responsive presentation and accessibility styles
- `assets/images/` — optimized site and partner images
- `documents/programmes/` — current and archived programme downloads
- `documents/travel/` — destination PDFs
- `documents/notices/` — standalone notices
- `source/` — high-resolution and editable source artwork
- `archive/` — superseded site copies, the former JavaScript theme, backups, and unused assets
- route directories and redirect HTML files at the root — compatibility redirects for old public URLs

## CDN paths

The CDN mirrors this repository's relative file paths. A local file such as
`assets/images/site/logo.png` is therefore available at:

`https://geoculturde.cdn.tiekoetter.cloud/assets/images/site/logo.png`

When moving a file used by the website, update its CDN URL to the same relative
path.

Run `node scripts/validate-paths.mjs` after changing paths. It checks that every
active CDN URL and in-page link has a matching file or section. It also verifies
that the public page has one main heading and remains free of JavaScript and
inline event handlers.

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

The public site uses semantic HTML and does not require JavaScript. It includes
a skip link, landmarks, a single logical heading structure, visible keyboard
focus, large interaction targets, responsive reflow, reduced-motion support,
descriptive image text, and a native `details` element for the expandable
profile.
