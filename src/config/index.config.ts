import type { ConfigType } from "../types";

export const CONFIG_FILE = "config.json";
export const CONFIG_TYPE = "types.txt";

// Default config
export const DEFAULT_CONFIG: ConfigType = {
  //pizda

  DIMENSIONS: {
    MIN_HEIGHT: 1440,
    MIN_WIDTH: 2560,
  },
  RATIO: {
    RATIO_HEIGHT: 9,
    RATIO_WIDTH: 16,
  },
  DRY_RUN: false,
  OUTPUT_PATH: "./output.txt",
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  IMAGE_PATTERNS: [
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
  ],
  ALLOWED_DIRECTORIES: ["./", "./images", "./photos", "./pictures"],
  RESTRICT_TO_IMAGES_FOLDER: true,
  PAUSE_ON_COMPLETE: true,
  PAUSE_ON_ERROR: true,
  PROGRESS_SHOW: true,
};

export const PROTECTED_DIRECTORIES = [
  "/System",
  "/Windows",
  "/usr",
  "/etc",
  "/bin",
  "/sbin",
  "/var",
  "/proc",
  "/dev",
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
];
