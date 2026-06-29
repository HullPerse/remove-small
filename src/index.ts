import { Glob } from "bun";
import path from "node:path";
import { type ConfigType } from "./types";
import Logger from "./lib/logger.utils";
import {
  getScanRoots,
  isInAllowedDirectory,
  isLarge,
  isProtectedPath,
  loadConfig,
  pauseConsole,
  removeFile,
} from "./lib/index.utils";
import { CONFIG_FILE } from "./config/index.config";

const logger = new Logger("SYSTEM");

const configFileExists = await Bun.file(CONFIG_FILE).exists();

const config: ConfigType = await loadConfig();

if (!configFileExists) {
  logger
    .setAuthor("CONFIG")
    .log(`Please edit "${CONFIG_FILE}" to your preferences`);
  logger.setAuthor("CONFIG").log("Then run the script again to start scanning");

  await pauseConsole("Press Enter to exit...");
  process.exit(0);
}

const ROOT: string = process.cwd();

const deletedFiles: string[] = [];

async function main() {
  let kept = 0;
  let removed = 0;
  let skipped = 0;

  const files = new Set<string>();
  const failedFiles: string[] = [];
  const securityBlockedFiles: string[] = [];

  await Bun.file(config.OUTPUT_PATH)
    .delete()
    .catch(() => {});

  const scanRoots: string[] = await getScanRoots(config, ROOT);

  logger.setAuthor("INFO").log("Starting scan...");
  logger.setAuthor("INFO").log(`Scan roots: ${scanRoots.join(", ")}`);

  for (const root of scanRoots) {
    for (const pattern of config.IMAGE_PATTERNS) {
      const glob = new Glob(pattern);
      for await (const file of glob.scan(root)) {
        const fullPath = path.resolve(root, file);

        if (isProtectedPath(fullPath)) {
          logger
            .setAuthor("SECURITY")
            .warn(`Blocked access to protected directory: ${fullPath}`);
          securityBlockedFiles.push(fullPath);
          continue;
        }

        if (!isInAllowedDirectory(fullPath, config)) {
          logger
            .setAuthor("SECURITY")
            .warn(`File not in allowed directory: ${fullPath}`);
          securityBlockedFiles.push(fullPath);
          continue;
        }

        files.add(fullPath);
      }
    }
  }

  logger.setAuthor("INFO").log(`Found ${files.size} images to process`);
  if (securityBlockedFiles.length > 0) {
    logger
      .setAuthor("SECURITY")
      .log(
        `Blocked ${securityBlockedFiles.length} files outside allowed directories`,
      );
  }

  let processed = 0;
  const totalFiles = files.size;

  for (const file of files) {
    processed++;
    if (
      (config.PROGRESS_SHOW && processed % 10 === 0) ||
      processed === totalFiles
    ) {
      logger
        .setAuthor("PROGRESS")
        .log(`Processing ${processed}/${totalFiles} files...`);
    }

    const ok = await isLarge(file, config);

    if (ok === true) {
      kept++;
      continue;
    }

    if (ok === null) {
      skipped++;
      logger
        .setAuthor("SKIP")
        .warn(`Skipping unreadable/unsupported image: ${file}`);
      continue;
    }

    if (config.DRY_RUN) {
      deletedFiles.push(
        `${deletedFiles.length + 1}: [DRY RUN] Would delete: ${file}`,
      );
      logger.setAuthor("DRY RUN").log(`Would delete: ${path.basename(file)}`);
      removed++;
    } else {
      try {
        await removeFile(file, config);
        logger.setAuthor("DELETED").log(`${path.basename(file)}`);
        removed++;
      } catch (error: any) {
        logger
          .setAuthor("ERROR")
          .error(`Failed to delete ${path.basename(file)}: ${error.message}`);
        failedFiles.push(`${file}: ${error.message}`);
      }
    }
  }

  let output = deletedFiles.join("\n");
  if (failedFiles.length > 0) {
    output += `\n[ERROR] ${failedFiles.join("\n")}`;
  }
  if (securityBlockedFiles.length > 0) {
    output += `\n[SECURITY] Blocked files outside allowed directories:\n${securityBlockedFiles.join("\n")}`;
  }

  if (config.DRY_RUN) {
    await Bun.write(config.OUTPUT_PATH, output + "\n");
    logger
      .setAuthor("INFO")
      .log(`Dry run results written to: ${config.OUTPUT_PATH}`);
  }

  logger.log("\n" + "=".repeat(50));
  logger.setAuthor("SUMMARY").log(`Kept: ${kept}`);
  logger.setAuthor("SUMMARY").log(`Removed: ${removed}`);
  logger.setAuthor("SUMMARY").log(`Skipped: ${skipped}`);
  logger.setAuthor("SUMMARY").log(`Dry Run: ${config.DRY_RUN}`);

  if (securityBlockedFiles.length > 0) {
    logger
      .setAuthor("SECURITY")
      .log(`Blocked: ${securityBlockedFiles.length} files`);
  }

  if (failedFiles.length > 0) {
    logger.setAuthor("ERROR").log(`Failed: ${failedFiles.length} files`);
  }

  console.log("\n" + "=".repeat(50));

  if (failedFiles.length > 0) {
    logger
      .setAuthor("ERROR")
      .error(
        `${failedFiles.length} files failed to delete. Check ${config.OUTPUT_PATH} for details.`,
      );
  }

  if (securityBlockedFiles.length > 0) {
    logger
      .setAuthor("SECURITY")
      .log(
        `${securityBlockedFiles.length} files were blocked for security reasons.`,
      );
  }

  if (config.PAUSE_ON_COMPLETE) {
    await pauseConsole("Press Enter to exit...");
  }
}

await main().catch(async (error) => {
  logger.setAuthor("FATAL ERROR").error(String(error));
  if (config.PAUSE_ON_ERROR) {
    await pauseConsole("[ERROR]. Press Enter to exit...");
  }
});
