import { LogLevel } from "@sapphire/framework";
import logger from "./logger.js";

export class SapphirePinoLogger {
  constructor(level = LogLevel.Info) {
    this.level = level;
  }

  // Sapphire uses this to check if a level is enabled
  has(level) {
    return level >= this.level;
  }

  trace(message) {
    if (this.has(LogLevel.Trace)) logger.debug(message);
  }

  debug(message) {
    if (this.has(LogLevel.Debug)) logger.debug(message);
  }

  info(message) {
    if (this.has(LogLevel.Info)) logger.info(message);
  }

  warn(message) {
    if (this.has(LogLevel.Warn)) logger.warn(message);
  }

  error(message) {
    if (this.has(LogLevel.Error)) logger.error(message);
  }

  fatal(message) {
    if (this.has(LogLevel.Fatal)) logger.error(message);
  }
}
