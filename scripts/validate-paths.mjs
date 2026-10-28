import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : sourceRoot;
const pageFiles = [
  "index.html",
  "aktuelles/index.html",
  "programm/index.html",
  "impressum/index.html",
];
const activeFiles = [...pageFiles, "assets/css/site.css"];
const redirectFiles = [
  "download/index.html",
  "Downloads.html",
  "Kontakt.html",
  "m_index.html",
  "reisen-aktuell/index.html",
  "reisen-zukunft/index.html",
];
const cdnPrefix = "https://geoculturde.cdn.tiekoetter.cloud/";
const missingPaths = new Set();
const checkedPaths = new Set();
const failures = [];
const canonicalUrls = new Set();
let checkedFragments = 0;

function checkPath(relativePath, sourceFile) {
  const normalizedPath = relativePath.split(/[?#]/, 1)[0];
  checkedPaths.add(normalizedPath);

  if (!existsSync(resolve(repositoryRoot, normalizedPath))) {
    missingPaths.add(`${normalizedPath} (referenced by ${sourceFile})`);
  }
}

function localPageForUrl(urlPath) {
  const pathWithoutFragment = urlPath.split("#", 1)[0];
  if (pathWithoutFragment === "/") {
    return "index.html";
  }
  const relativePath = pathWithoutFragment.replace(/^\//, "");
  return relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath;
}

for (const activeFile of activeFiles) {
  const content = readFileSync(resolve(repositoryRoot, activeFile), "utf8");
  const cdnUrlPattern = /https:\/\/geoculturde\.cdn\.tiekoetter\.cloud\/[^\s"'<>);]+/g;

  for (const cdnUrl of content.match(cdnUrlPattern) ?? []) {
    checkPath(cdnUrl.slice(cdnPrefix.length), activeFile);
  }

  for (const [, localAsset] of content.matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) {
    checkPath(localAsset.slice(1), activeFile);
  }

  if (content.includes("geoculturde-cdn.tiekoetter.cloud")) {
    failures.push(`${activeFile} still references the retired CDN hostname.`);
  }
}

for (const pageFile of pageFiles) {
  const content = readFileSync(resolve(repositoryRoot, pageFile), "utf8");
  const idList = [...content.matchAll(/\sid=["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  const documentIds = new Set(idList);
  const fragmentLinks = new Set(
    [...content.matchAll(/\shref=["']#([^"']+)["']/g)].map((match) => match[1]),
  );
  checkedFragments += fragmentLinks.size;

  if (documentIds.size !== idList.length) {
    failures.push(`${pageFile} contains duplicate IDs.`);
  }
  for (const fragment of fragmentLinks) {
    if (!documentIds.has(fragment)) {
      failures.push(`${pageFile} links to missing section #${fragment}.`);
    }
  }

  for (const imageTag of content.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\salt=["'][^"']*["']/.test(imageTag)) {
      failures.push(`${pageFile} has an image without alt text.`);
    }
    if (!/\swidth=["']\d+["']/.test(imageTag) || !/\sheight=["']\d+["']/.test(imageTag)) {
      failures.push(`${pageFile} has an image without intrinsic dimensions.`);
    }
  }

  for (const ariaReference of content.matchAll(
    /\saria-(?:labelledby|describedby)=["']([^"']+)["']/g,
  )) {
    for (const referencedId of ariaReference[1].split(/\s+/)) {
      if (!documentIds.has(referencedId)) {
        failures.push(`${pageFile} has an ARIA reference to missing ID #${referencedId}.`);
      }
    }
  }

  const headingLevels = [...content.matchAll(/<h([1-6])(?:\s|>)/g)].map(
    (match) => Number(match[1]),
  );
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      failures.push(
        `${pageFile} jumps from h${headingLevels[index - 1]} to h${headingLevels[index]}.`,
      );
    }
  }

  if (!/<html\s+lang=["']de["']/.test(content)) {
    failures.push(`${pageFile} must declare German as its language.`);
  }
  if (!/<main\s/.test(content)) {
    failures.push(`${pageFile} must contain a main landmark.`);
  }
  if ((content.match(/<h1(?:\s|>)/g) ?? []).length !== 1) {
    failures.push(`${pageFile} must contain exactly one h1.`);
  }
  if (!/class=["']skip-link["']/.test(content)) {
    failures.push(`${pageFile} must contain a skip link.`);
  }

  const title = content.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']>/)?.[1];
  const canonicalUrl = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']>/)?.[1];
  const openGraphUrl = content.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']>/)?.[1];

  if (!title || !description) {
    failures.push(`${pageFile} must have a title and meta description.`);
  }
  if (!canonicalUrl?.startsWith("https://www.geocultur.de/")) {
    failures.push(`${pageFile} must have a www.geocultur.de canonical URL.`);
  } else {
    canonicalUrls.add(canonicalUrl);
  }
  if (openGraphUrl !== canonicalUrl) {
    failures.push(`${pageFile} Open Graph URL must match its canonical URL.`);
  }
  for (const requiredMetadata of [
    /<meta\s+name=["']robots["']\s+content=["'][^"']+["']>/,
    /<meta\s+property=["']og:title["']\s+content=["'][^"']+["']>/,
    /<meta\s+property=["']og:description["']\s+content=["'][^"']+["']>/,
    /<meta\s+property=["']og:image["']\s+content=["'][^"']+["']>/,
    /<meta\s+name=["']twitter:card["']\s+content=["'][^"']+["']>/,
  ]) {
    if (!requiredMetadata.test(content)) {
      failures.push(`${pageFile} is missing required SEO or social metadata.`);
      break;
    }
  }

  const structuredDataPattern = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  const structuredDataBlocks = [...content.matchAll(structuredDataPattern)];
  if (structuredDataBlocks.length === 0) {
    failures.push(`${pageFile} must contain structured data.`);
  }
  for (const [, structuredData] of structuredDataBlocks) {
    try {
      JSON.parse(structuredData);
    } catch {
      failures.push(`${pageFile} contains invalid JSON-LD.`);
    }
  }
  const navigationBlocks = [...content.matchAll(
    /<nav\b[^>]*aria-label=["'][^"']*Hauptnavigation[^"']*["'][^>]*>([\s\S]*?)<\/nav>/g,
  )];
  if (
    navigationBlocks.length !== 2
    || navigationBlocks.some(([, navigation]) => (
      navigation.match(/aria-current=["']page["']/g) ?? []
    ).length !== 1)
  ) {
    failures.push(`${pageFile} must identify one current item in each navigation.`);
  }
  const contentWithoutStructuredData = content.replace(structuredDataPattern, "");
  if (/<script(?:\s|>)/i.test(contentWithoutStructuredData) || /\son[a-z]+\s*=/i.test(content)) {
    failures.push(`${pageFile} must not require executable JavaScript or inline event handlers.`);
  }

  for (const [, urlPath] of content.matchAll(/\shref=["'](\/[^"']*)["']/g)) {
    const localPage = localPageForUrl(urlPath);
    if (!existsSync(resolve(repositoryRoot, localPage))) {
      failures.push(`${pageFile} links to missing local page ${urlPath}.`);
    }
  }
}

for (const redirectFile of redirectFiles) {
  const content = readFileSync(resolve(repositoryRoot, redirectFile), "utf8");
  const targetPath = content.match(/URL=(\/[^"']*)/)?.[1];

  if (!targetPath || !existsSync(resolve(repositoryRoot, localPageForUrl(targetPath)))) {
    failures.push(`${redirectFile} has a missing or invalid redirect target.`);
  }
  if (!/<html\s+lang=["']de["']/.test(content) || !/<main>/.test(content)) {
    failures.push(`${redirectFile} is missing its language or main landmark.`);
  }
  if (!/<meta\s+name=["']robots["']\s+content=["']noindex,follow["']>/.test(content)) {
    failures.push(`${redirectFile} must prevent indexing while allowing link discovery.`);
  }
  if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.geocultur\.de\//.test(content)) {
    failures.push(`${redirectFile} must declare its canonical www.geocultur.de target.`);
  }
}

if (readFileSync(resolve(repositoryRoot, "CNAME"), "utf8").trim() !== "geoculturde.cdn.tiekoetter.cloud") {
  failures.push("CNAME does not declare the expected GitHub Pages hostname.");
}
if (!existsSync(resolve(repositoryRoot, ".nojekyll"))) {
  failures.push("The GitHub Pages deployment requires .nojekyll.");
}
const sitemap = readFileSync(resolve(repositoryRoot, "sitemap.xml"), "utf8");
const robots = readFileSync(resolve(repositoryRoot, "robots.txt"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (canonicalUrls.size !== pageFiles.length || sitemapUrls.length !== pageFiles.length) {
  failures.push("Canonical URLs and sitemap entries must be unique for every public page.");
}
for (const canonicalUrl of canonicalUrls) {
  if (!sitemap.includes(`<loc>${canonicalUrl}</loc>`)) {
    failures.push(`Sitemap is missing canonical URL ${canonicalUrl}.`);
  }
}
if (!robots.includes("Sitemap: https://www.geocultur.de/sitemap.xml")) {
  failures.push("robots.txt does not advertise the canonical sitemap.");
}
for (const missingPath of missingPaths) {
  failures.push(`Missing mirrored path: ${missingPath}.`);
}

if (failures.length > 0) {
  console.error("Validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${pageFiles.length} pages, ${checkedPaths.size} mirrored paths, SEO metadata, and ${checkedFragments} in-page links; public pages use no executable JavaScript.`,
  );
}
