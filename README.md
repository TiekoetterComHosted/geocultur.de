# geocultur.de

Static website for Prof. Dr. Heinz Schürmann.

## Layout

- `index.html` — public application shell
- `pages/` — HTML fragments loaded by the application shell
- `assets/` — browser assets, fonts, and optimized images
- `documents/programmes/` — current and archived programme downloads
- `documents/travel/` — destination PDFs
- `documents/notices/` — standalone notices
- `source/` — high-resolution and editable source artwork
- `archive/` — superseded site copies, backups, and unused assets
- route directories and redirect HTML files at the root — compatibility redirects for old public URLs

## CDN paths

The CDN mirrors this repository's relative file paths. A local file such as
`assets/images/site/logo.png` is therefore available at:

`https://geoculturde-cdn.tiekoetter.cloud/assets/images/site/logo.png`

When moving a file used by the website, update its CDN URL to the same relative
path.

Run `node scripts/validate-paths.mjs` after changing paths. It checks that every
active CDN URL, dynamically loaded page, and travel PDF points to a file in this
repository.
