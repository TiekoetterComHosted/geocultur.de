import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rasterPattern = /\.(?:jpe?g|png)$/i;

function findRasterImages(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        return findRasterImages(entryPath);
      }

      return entry.isFile() && rasterPattern.test(entry.name) ? [entryPath] : [];
    });
}

function encoderArguments(inputPath, outputPath) {
  const commonArguments = ["-quiet", "-mt", "-metadata", "none"];

  if (/\.png$/i.test(inputPath)) {
    return [
      ...commonArguments,
      "-lossless",
      "-m",
      "6",
      "-q",
      "90",
      inputPath,
      "-o",
      outputPath,
    ];
  }

  return [
    ...commonArguments,
    "-m",
    "6",
    "-q",
    "82",
    inputPath,
    "-o",
    outputPath,
  ];
}

export function convertImages(imageRoot) {
  const inputPaths = findRasterImages(imageRoot);
  let sourceBytes = 0;
  let webpBytes = 0;

  for (const inputPath of inputPaths) {
    const outputPath = `${inputPath}.webp`;
    const result = spawnSync(
      "cwebp",
      encoderArguments(inputPath, outputPath),
      { encoding: "utf8" },
    );

    if (result.error?.code === "ENOENT") {
      throw new Error(
        "The cwebp encoder is required. Install the WebP tools package before building the site.",
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `cwebp failed for ${inputPath}: ${result.stderr?.trim() || "unknown error"}`,
      );
    }

    sourceBytes += statSync(inputPath).size;
    webpBytes += statSync(outputPath).size;
  }

  return {
    count: inputPaths.length,
    sourceBytes,
    webpBytes,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;

if (invokedPath === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error("Usage: node scripts/convert-images.mjs <image-directory>");
    process.exitCode = 1;
  } else {
    const result = convertImages(resolve(process.argv[2]));
    console.log(
      `Created ${result.count} WebP images (${result.sourceBytes} bytes -> ${result.webpBytes} bytes).`,
    );
  }
}
