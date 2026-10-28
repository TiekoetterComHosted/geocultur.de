import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, "_site");
const programmeDirectory = resolve(repositoryRoot, "documents/programmes");
const programmePattern = /^Reisen-aktuell-(\d{4})-(0[1-9]|1[0-2])\.pdf$/;
const publicEntries = [
  ".nojekyll",
  "CNAME",
  "Downloads.html",
  "Kontakt.html",
  "aktuelles",
  "assets",
  "documents",
  "download",
  "favicon.ico",
  "impressum",
  "index.html",
  "m_index.html",
  "programm",
  "reisen-aktuell",
  "reisen-zukunft",
];

function replaceMarkedSection(content, startMarker, endMarker, replacement) {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing or invalid ${startMarker} section.`);
  }
  if (
    content.indexOf(startMarker, startIndex + startMarker.length) !== -1
    || content.indexOf(endMarker, endIndex + endMarker.length) !== -1
  ) {
    throw new Error(`Expected exactly one ${startMarker} section.`);
  }

  return `${content.slice(0, startIndex)}${replacement}${content.slice(endIndex + endMarker.length)}`;
}

const programmes = readdirSync(programmeDirectory)
  .map((filename) => ({ filename, match: filename.match(programmePattern) }))
  .filter(({ match }) => match)
  .sort((left, right) => right.filename.localeCompare(left.filename));

if (programmes.length === 0) {
  throw new Error("No programme PDF matches Reisen-aktuell-YYYY-MM.pdf.");
}

const currentProgramme = programmes[0];
const currentPath = resolve(programmeDirectory, currentProgramme.filename);
const currentFile = readFileSync(currentPath);

if (currentFile.length === 0 || currentFile.subarray(0, 5).toString() !== "%PDF-") {
  throw new Error(`${currentProgramme.filename} is not a valid, non-empty PDF.`);
}

const year = Number(currentProgramme.match[1]);
const month = Number(currentProgramme.match[2]);
const issue = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(Date.UTC(year, month - 1, 1)));
const sizeInKilobytes = Math.ceil(statSync(currentPath).size / 1024);
const downloadUrl = `https://geoculturde.cdn.tiekoetter.cloud/documents/programmes/${currentProgramme.filename}`;
const startMarker = "<!-- current-programme:start -->";
const endMarker = "<!-- current-programme:end -->";
const programmeBlock = `${startMarker}
            <p id="programme-meta">Ausgabe: ${issue} · PDF · ${sizeInKilobytes} KB</p>
            <p><a class="primary-link" href="${downloadUrl}" aria-describedby="programme-meta">Programm als PDF öffnen</a></p>
            ${endMarker}`;

rmSync(outputRoot, { force: true, recursive: true });
mkdirSync(outputRoot, { recursive: true });

for (const entry of publicEntries) {
  cpSync(resolve(repositoryRoot, entry), resolve(outputRoot, entry), {
    recursive: true,
  });
}

const programmePagePath = resolve(outputRoot, "programm/index.html");
const programmePage = readFileSync(programmePagePath, "utf8");
writeFileSync(
  programmePagePath,
  replaceMarkedSection(programmePage, startMarker, endMarker, programmeBlock),
);

console.log(
  `Built _site with ${currentProgramme.filename} (${issue}, ${sizeInKilobytes} KB).`,
);
