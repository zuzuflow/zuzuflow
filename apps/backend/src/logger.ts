import winston from "winston";
import { config } from "./config";

// =============================================================================
// Winston logger — structured JSON in production, colorized in development
// =============================================================================

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${ts} [${level}] ${stack ?? message}${metaStr}`;
  })
);

const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format:
    config.NODE_ENV === "production" ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});
