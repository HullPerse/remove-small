export type LogLevel = "debug" | "info" | "warn" | "error";

export type ConfigType = {
  DIMENSIONS: {
    MIN_HEIGHT: number;
    MIN_WIDTH: number;
    RATIO_HEIGHT: number;
    RATIO_WIDTH: number;
  };
  DRY_RUN: boolean;
  OUTPUT_PATH: string;
  RETRY_COUNT: number;
  DELAY: number;
  IMAGE_PATTERNS: string[];
  ALLOWED_DIRECTORIES: string[];
  RESTRICT_TO_IMAGES_FOLDER: boolean;
  PAUSE_ON_COMPLETE: boolean;
  PAUSE_ON_ERROR: boolean;
  PROGRESS_SHOW: boolean;
};
