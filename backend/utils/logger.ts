/**
 * Structured Logging Utility
 * Provides consistent, parseable logging across the application
 */

import { Request, Response } from "express";

const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL =
  process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug");

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LogMetadata {
  [key: string]: unknown;
}

interface HttpLogData extends LogMetadata {
  method: string;
  path: string;
  statusCode: number;
  duration: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  [key: string]: unknown;
}

class Logger {
  private context: string;

  constructor(context: string = "app") {
    this.context = context;
  }

  /**
   * Format log message with timestamp and metadata
   */
  format(level: LogLevel, message: string, metadata: LogMetadata = {}): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...metadata,
    };

    // In production, output JSON for log aggregation tools
    // In development, output human-readable format
    if (NODE_ENV === "production") {
      return JSON.stringify(logEntry);
    } else {
      const metaStr =
        Object.keys(metadata).length > 0
          ? " " + JSON.stringify(metadata, null, 2)
          : "";
      return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${this.context}] ${message}${metaStr}`;
    }
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, metadata: LogMetadata = {}): void {
    if (this.shouldLog("debug")) {
      // eslint-disable-next-line no-console
      console.log(this.format("debug", message, metadata));
    }
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, metadata: LogMetadata = {}): void {
    if (this.shouldLog("info")) {
      // eslint-disable-next-line no-console
      console.log(this.format("info", message, metadata));
    }
  }

  /**
   * Warn level - warning messages
   */
  warn(message: string, metadata: LogMetadata = {}): void {
    if (this.shouldLog("warn")) {
      console.warn(this.format("warn", message, metadata));
    }
  }

  /**
   * Error level - error messages
   */
  error(
    message: string,
    errorOrMetadata?: Error | LogMetadata | null,
    metadata?: LogMetadata,
  ): void {
    if (this.shouldLog("error")) {
      let errorMeta: LogMetadata = {};

      // Handle different argument combinations
      if (errorOrMetadata instanceof Error) {
        errorMeta = {
          error: {
            message: errorOrMetadata.message,
            stack: errorOrMetadata.stack,
            ...(metadata || {}),
          },
        };
      } else if (errorOrMetadata) {
        errorMeta = errorOrMetadata;
      }

      console.error(this.format("error", message, errorMeta));
    }
  }

  /**
   * HTTP request logging
   */
  http(
    req: Request & { id?: string; user?: { user_id: string } },
    res: Response,
    duration: number,
  ): void {
    const logData: HttpLogData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
      userAgent: req.get("user-agent"),
      ip: req.ip,
    };

    if (req.user) {
      logData.userId = req.user.user_id;
    }

    const level: LogLevel =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    this[level](`${req.method} ${req.path}`, logData);
  }

  /**
   * Database query logging
   */
  query(query: string, duration: number, error: Error | null = null): void {
    if (error) {
      this.error("Database query failed", error, {
        query: query.substring(0, 100),
        duration: `${duration}ms`,
      });
    } else {
      this.debug("Database query executed", {
        query: query.substring(0, 100),
        duration: `${duration}ms`,
      });
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`);
  }
}

// Create default logger instance
const logger = new Logger("app");

// Export both the class and default instance
export { Logger, logger, LogLevel, LogMetadata, LogEntry };

// Convenience function for creating loggers
export const createLogger = (context: string): Logger => new Logger(context);
