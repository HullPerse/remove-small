import { Glob } from "bun";
import path from "node:path";

const ROOT = process.cwd();
const MIN_WIDTH = 2560;
const MIN_HEIGHT = 1440;
const DRY_RUN = true; // false - delete files, true - just list files
const OUTPUT_PATH = "./output.txt";

const deletedFiles: string[] = [];

const IMAGE_PATTERNS = [
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.png",
  "**/*.webp",
  "**/*.avif",
  "**/*.tif",
  "**/*.tiff",
  "**/*.gif",
  "**/*.bmp",
  "**/*.heic",
];

async function isImageLargeEnough(filePath: string) {
  try {
    const meta = await new Bun.Image(filePath).metadata();

    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    return width >= MIN_WIDTH && height >= MIN_HEIGHT;
  } catch {
    return null;
  }
}

async function main() {
  const files = new Set<string>();

  await Bun.file(OUTPUT_PATH).delete();

  for (const pattern of IMAGE_PATTERNS) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan(ROOT)) {
      files.add(path.resolve(ROOT, file));
    }
  }

  let kept = 0;
  let removed = 0;
  let skipped = 0;

  for (const file of files) {
    const ok = await isImageLargeEnough(file);

    if (ok === true) {
      kept++;
      continue;
    }

    if (ok === null) {
      skipped++;
      console.warn(`Skipping unreadable/unsupported image: ${file}`);
      continue;
    }

    if (DRY_RUN) {
      deletedFiles.push(
        `${deletedFiles.length + 1}: [DRY RUN] Would delete: ${file}`,
      );
    } else {
      await Bun.file(file).delete();
      console.log(`Deleted: ${file}`);
    }
    removed++;
  }

  await Bun.write(OUTPUT_PATH, deletedFiles.join("\n") + "\n");
  console.log(
    `Done. Kept: ${kept}, removed: ${removed}, skipped: ${skipped}, dryRun: ${DRY_RUN}`,
  );
}

await main();
