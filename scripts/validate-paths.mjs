import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activeFiles = ["index.html", "assets/css/site.css"];
const redirectFiles = [
  "Downloads.html",
  "Kontakt.html",
  "m_index.html",
  "aktuelles/index.html",
  "download/index.html",
  "impressum/index.html",
  "reisen-aktuell/index.html",
  "reisen-zukunft/index.html",
];
const missingPaths = new Set();
const checkedPaths = new Set();
const cdnPrefix = "https://geoculturde.cdn.tiekoetter.cloud/";

function checkPath(relativePath, sourceFile) {
  const normalizedPath = relativePath.split(/[?#]/, 1)[0];
  checkedPaths.add(normalizedPath);

  if (!existsSync(resolve(repositoryRoot, normalizedPath))) {
    missingPaths.add(`${normalizedPath} (referenced by ${sourceFile})`);
  }
}

for (const activeFile of activeFiles) {
  const content = readFileSync(resolve(repositoryRoot, activeFile), "utf8");
  const cdnUrlPattern = /https:\/\/geoculturde\.cdn\.tiekoetter\.cloud\/[^\s"'<>);]+/g;

  for (const cdnUrl of content.match(cdnUrlPattern) ?? []) {
    checkPath(cdnUrl.slice(cdnPrefix.length), activeFile);
  }
}

const indexContent = readFileSync(resolve(repositoryRoot, "index.html"), "utf8");
const idList = [...indexContent.matchAll(/\sid=["']([^"']+)["']/g)].map(
  (match) => match[1],
);
const documentIds = new Set(idList);
const fragmentLinks = new Set(
  [...indexContent.matchAll(/\shref=["']#([^"']+)["']/g)].map((match) => match[1]),
);
const missingFragments = [...fragmentLinks].filter((fragment) => !documentIds.has(fragment));
const headingCount = (indexContent.match(/<h1(?:\s|>)/g) ?? []).length;
const failures = [];

if (readFileSync(resolve(repositoryRoot, "CNAME"), "utf8").trim() !== "geoculturde.cdn.tiekoetter.cloud") {
  failures.push("CNAME does not declare the expected GitHub Pages hostname.");
}
if (!existsSync(resolve(repositoryRoot, ".nojekyll"))) {
  failures.push("The branch-based GitHub Pages mirror requires .nojekyll.");
}

if (documentIds.size !== idList.length) {
  failures.push("The public document contains duplicate IDs.");
}

for (const imageTag of indexContent.match(/<img\b[^>]*>/g) ?? []) {
  if (!/\salt=["'][^"']*["']/.test(imageTag)) {
    failures.push(`Image is missing alt text: ${imageTag}`);
  }
  if (!/\swidth=["']\d+["']/.test(imageTag) || !/\sheight=["']\d+["']/.test(imageTag)) {
    failures.push(`Image is missing intrinsic dimensions: ${imageTag}`);
  }
}

for (const ariaReference of indexContent.matchAll(
  /\saria-(?:labelledby|describedby)=["']([^"']+)["']/g,
)) {
  for (const referencedId of ariaReference[1].split(/\s+/)) {
    if (!documentIds.has(referencedId)) {
      failures.push(`ARIA references missing ID #${referencedId}.`);
    }
  }
}

const headingLevels = [...indexContent.matchAll(/<h([1-6])(?:\s|>)/g)].map(
  (match) => Number(match[1]),
);
for (let index = 1; index < headingLevels.length; index += 1) {
  if (headingLevels[index] > headingLevels[index - 1] + 1) {
    failures.push(
      `Heading level jumps from h${headingLevels[index - 1]} to h${headingLevels[index]}.`,
    );
  }
}

for (const redirectFile of redirectFiles) {
  const content = readFileSync(resolve(repositoryRoot, redirectFile), "utf8");
  const targetFragment = content.match(/URL=\/#([a-z-]+)/)?.[1];

  if (targetFragment && !documentIds.has(targetFragment)) {
    failures.push(`${redirectFile} points to missing section #${targetFragment}.`);
  }
  if (!/<html\s+lang=["']de["']/.test(content) || !/<main>/.test(content)) {
    failures.push(`${redirectFile} is missing its language or main landmark.`);
  }
}

if (!/<html\s+lang=["']de["']/.test(indexContent)) {
  failures.push("The public document must declare German as its language.");
}
if (!/<main\s/.test(indexContent)) {
  failures.push("The public document must contain a main landmark.");
}
if (headingCount !== 1) {
  failures.push(`Expected exactly one h1, found ${headingCount}.`);
}
if (!/class=["']skip-link["']/.test(indexContent)) {
  failures.push("The public document must contain a skip link.");
}
if (/<script(?:\s|>)/i.test(indexContent)) {
  failures.push("The public document must not require JavaScript.");
}
if (/\son[a-z]+\s*=/i.test(indexContent)) {
  failures.push("The public document must not contain inline event handlers.");
}
for (const fragment of missingFragments) {
  failures.push(`Missing section for in-page link #${fragment}.`);
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
    `Validated ${checkedPaths.size} mirrored paths and ${fragmentLinks.size} in-page links; public page uses no JavaScript.`,
  );
}
