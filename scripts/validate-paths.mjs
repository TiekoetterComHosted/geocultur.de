import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activeFiles = [
  "index.html",
  "assets/css/main.css",
  "pages/home.html",
  "pages/imprint.html",
  "pages/news.html",
  "pages/programme.html",
  "pages/travel/2020.html",
  "pages/travel/2021.html",
  "pages/travel/cancelled.html",
];

const missingPaths = new Set();
const checkedPaths = new Set();
const cdnPrefix = "https://geoculturde-cdn.tiekoetter.cloud/";

function checkPath(relativePath, sourceFile) {
  const normalizedPath = relativePath.split(/[?#]/, 1)[0];
  checkedPaths.add(normalizedPath);

  if (!existsSync(resolve(repositoryRoot, normalizedPath))) {
    missingPaths.add(`${normalizedPath} (referenced by ${sourceFile})`);
  }
}

for (const activeFile of activeFiles) {
  const content = readFileSync(resolve(repositoryRoot, activeFile), "utf8");
  const cdnUrlPattern = /https:\/\/geoculturde-cdn\.tiekoetter\.cloud\/[^\s"'<>);]+/g;

  for (const cdnUrl of content.match(cdnUrlPattern) ?? []) {
    checkPath(cdnUrl.slice(cdnPrefix.length), activeFile);
  }
}

const indexContent = readFileSync(resolve(repositoryRoot, "index.html"), "utf8");
for (const [, pagePath] of indexContent.matchAll(/["'](pages\/[^"']+\.html)["']/g)) {
  checkPath(pagePath, "index.html");
}

const travelPage = readFileSync(
  resolve(repositoryRoot, "pages/travel/2020.html"),
  "utf8",
);
for (const [, documentName] of travelPage.matchAll(/loadPDF\('([^']+)'\)/g)) {
  checkPath(`documents/travel/${documentName}.pdf`, "pages/travel/2020.html");
}

if (missingPaths.size > 0) {
  console.error("Missing mirrored paths:");
  for (const missingPath of missingPaths) {
    console.error(`- ${missingPath}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${checkedPaths.size} local and mirrored paths.`);
}
