import path from "node:path";
import { DEFAULT_CONFIG, PROTECTED_DIRECTORIES } from "../config/index.config";
import type { ConfigType } from "../types";
import Logger from "./logger.utils";

const logger = new Logger("SYSTEM");

const CONFIG_FILE = "config.json";

export async function loadConfig(): Promise<ConfigType> {
  const configFile = Bun.file(CONFIG_FILE);

  try {
    if (await configFile.exists()) {
      const userConfig = JSON.parse(await configFile.text());
      return { ...DEFAULT_CONFIG, ...userConfig };
    } else {
      await Bun.write(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
      logger
        .setAuthor("CONFIG")
        .log(`Created default config file: ${CONFIG_FILE}`);

      return DEFAULT_CONFIG;
    }
  } catch (error) {
    logger
      .setAuthor("CONFIG")
      .error(`Error loading config, using defaults: ${error}`);
    return DEFAULT_CONFIG;
  }
}

export async function pauseConsole(
  message: string = "Press Enter to exit...",
): Promise<void> {
  console.log(`\n${message}`);

  const reader = Bun.stdin.stream().getReader();

  await reader.read();
  reader.releaseLock();
}

export function isProtectedPath(filePath: string): boolean {
  const normalizedPath = path.resolve(filePath);
  return PROTECTED_DIRECTORIES.some((dir) =>
    normalizedPath.startsWith(path.resolve(dir)),
  );
}

export function isInAllowedDirectory(
  filePath: string,
  config: ConfigType,
): boolean {
  if (!config.ALLOWED_DIRECTORIES || config.ALLOWED_DIRECTORIES.length === 0) {
    return true;
  }

  const normalizedPath = path.resolve(filePath);

  return config.ALLOWED_DIRECTORIES.some((dir) => {
    const normalizedAllowed = path.resolve(dir);
    return normalizedPath.startsWith(normalizedAllowed);
  });
}

export async function getScanRoots(
  config: ConfigType,
  ROOT: string,
): Promise<string[]> {
  if (config.RESTRICT_TO_IMAGES_FOLDER) {
    const imagesPath = path.resolve(ROOT, "images");
    const file = Bun.file(imagesPath);
    const exists = await file.exists();
    const isDirectory = (await file.stat()).isDirectory();

    if (exists && isDirectory) {
      logger.setAuthor("SECURITY").log(`Scanning restricted to: ${imagesPath}`);
      return [imagesPath];
    } else {
      logger
        .setAuthor("SECURITY")
        .warn(`Images folder not found at: ${imagesPath}`);
      logger
        .setAuthor("SECURITY")
        .warn(`Falling back to allowed directories or root`);
    }
  }

  if (config.ALLOWED_DIRECTORIES && config.ALLOWED_DIRECTORIES.length > 0) {
    const allowedRoots: string[] = [];
    for (const dir of config.ALLOWED_DIRECTORIES.map((dir) =>
      path.resolve(ROOT, dir),
    )) {
      const file = Bun.file(dir);
      if ((await file.exists()) && (await file.stat()).isDirectory()) {
        allowedRoots.push(dir);
      }
    }

    if (allowedRoots.length > 0) {
      logger
        .setAuthor("SECURITY")
        .log(
          `Scanning restricted to allowed directories: ${allowedRoots.join(", ")}`,
        );
      return allowedRoots;
    }
  }

  logger
    .setAuthor("SECURITY")
    .warn(`No valid allowed directories found, scanning from root: ${ROOT}`);
  return [ROOT];
}

export async function isLarge(filePath: string, config: ConfigType) {
  try {
    const metadata = await new Bun.Image(filePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (!width || !height) return null;

    const aspect = width / height;
    const ratio =
      Math.abs(
        aspect - config.DIMENSIONS.RATIO_WIDTH / config.DIMENSIONS.RATIO_HEIGHT,
      ) < 0.01;

    return (
      ratio &&
      width >= config.DIMENSIONS.MIN_WIDTH &&
      height >= config.DIMENSIONS.MIN_HEIGHT
    );
  } catch (error) {
    logger.setAuthor("ERROR").error(`Can't read ${filePath}: ${error}`);
    return null;
  }
}

export async function removeFile(filePath: string, config: ConfigType) {
  for (let attempt = 1; attempt <= config.RETRY_COUNT; attempt++) {
    try {
      await Bun.file(filePath).delete();
      return true;
    } catch (error: any) {
      if (error.code === "EBUSY" || error.code === "EPERM") {
        if (attempt < config.RETRY_COUNT) {
          logger
            .setAuthor("BUSY")
            .log(
              `${attempt}/${config.RETRY_COUNT}: ${path.basename(filePath)}`,
            );
          await new Promise((resolve) =>
            setTimeout(resolve, config.DELAY * attempt),
          );
          continue;
        }
      }
      throw error;
    }
  }
  return false;
}
