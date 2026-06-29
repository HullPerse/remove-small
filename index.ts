import { Glob } from "bun";
import path from "node:path";

type dimensionsType = {
  MIN_HEIGHT: number;
  MIN_WIDTH: number;
  RATIO_HEIGHT: number;
  RATIO_WIDTH: number;
};

const ROOT: string = process.cwd();
const DIMENSIONS: dimensionsType = {
  MIN_HEIGHT: 1440,
  MIN_WIDTH: 2560,
  RATIO_HEIGHT: 9,
  RATIO_WIDTH: 16,
};
const DRY_RUN: boolean = true; //false to delete
const OUTPUT_PATH: string = "./output.txt";
const RETRY_COUNT: number = 3;
const DELAY = 1000;

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

async function isLarge(filePath: string) {
  try {
    const metadata = await new Bun.Image(filePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (!width || !height) return null;

    const aspect = width / height;
    const ratio =
      Math.abs(aspect - DIMENSIONS.RATIO_WIDTH / DIMENSIONS.RATIO_HEIGHT) <
      0.01;

    return (
      ratio && width >= DIMENSIONS.MIN_WIDTH && height >= DIMENSIONS.MIN_HEIGHT
    );
  } catch (error) {
    console.error(`[ERROR] Can't read ${filePath}:`, error);
    return null;
  }
}

async function removeFile(filePath: string) {
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      await Bun.file(filePath).delete();
      return true;
    } catch (error: any) {
      if (error.code === "EBUSY" || error.code === "EPERM") {
        if (attempt < RETRY_COUNT) {
          console.log(
            `[BUSY] ${attempt}/${RETRY_COUNT}: ${path.basename(filePath)}`,
          );
          await new Promise((resolve) => setTimeout(resolve, DELAY * attempt));
          continue;
        }
      }
      throw error;
    }
  }
  return false;
}

async function main() {
  let kept = 0;
  let removed = 0;
  let skipped = 0;

  const files = new Set<string>();
  const failedFiles: string[] = [];

  await Bun.file(OUTPUT_PATH)
    .delete()
    .catch(() => {});

  for (const pattern of IMAGE_PATTERNS) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan(ROOT)) {
      files.add(path.resolve(ROOT, file));
    }
  }

  for (const file of files) {
    const ok = await isLarge(file);

    if (ok === true) {
      kept++;
      continue;
    }

    if (ok === null) {
      skipped++;
      console.warn(`[SKIP] Skipping unreadable/unsupported image: ${file}`);
      continue;
    }

    if (DRY_RUN) {
      deletedFiles.push(
        `${deletedFiles.length + 1}: [DRY RUN] Would delete: ${file}`,
      );
      console.log(`[DRY RUN] Would delete: ${path.basename(file)}`);
      removed++;
    } else {
      try {
        await removeFile(file);
        console.log(`[DELETED] ${path.basename(file)}`);
        removed++;
      } catch (error: any) {
        console.error(
          `[ERROR] Failed to delete ${path.basename(file)}:`,
          error.message,
        );
        failedFiles.push(`${file}: ${error.message}`);
      }
    }
  }

  let output = deletedFiles.join("\n");
  if (failedFiles.length > 0) output += `[ERROR] ${failedFiles.join("\n")}`;

  if (DRY_RUN) await Bun.write(OUTPUT_PATH, output + "\n");

  console.log(
    `[DONE] Kept: ${kept}, removed: ${removed}, skipped: ${skipped}, dryRun: ${DRY_RUN}`,
  );

  if (failedFiles.length > 0) {
    console.error(
      `[ERROR] ${failedFiles.length} files failed to delete. Check ${OUTPUT_PATH} for details \n`,
    );
  }
}

await main();
