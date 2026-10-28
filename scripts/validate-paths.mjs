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
  return `${pathWithoutFragment.replace(/^\//, "")}index.html`;
}

for (const activeFile of activeFiles) {
  const content = readFileSync(resolve(repositoryRoot, activeFile), "utf8");
  const cdnUrlPattern = /https:\/\/geoculturde\.cdn\.tiekoetter\.cloud\/[^\s"'<>);]+/g;

  for (const cdnUrl of content.match(cdnUrlPattern) ?? []) {
    checkPath(cdnUrl.slice(cdnPrefix.length), activeFile);
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
  if ((content.match(/aria-current=["']page["']/g) ?? []).length !== 1) {
    failures.push(`${pageFile} must identify exactly one current navigation item.`);
  }
  if (/<script(?:\s|>)/i.test(content) || /\son[a-z]+\s*=/i.test(content)) {
    failures.push(`${pageFile} must not require JavaScript or inline event handlers.`);
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
}

if (readFileSync(resolve(repositoryRoot, "CNAME"), "utf8").trim() !== "geoculturde.cdn.tiekoetter.cloud") {
  failures.push("CNAME does not declare the expected GitHub Pages hostname.");
}
if (!existsSync(resolve(repositoryRoot, ".nojekyll"))) {
  failures.push("The GitHub Pages deployment requires .nojekyll.");
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
    `Validated ${pageFiles.length} pages, ${checkedPaths.size} mirrored paths, and ${checkedFragments} in-page links; public pages use no JavaScript.`,
  );
}
