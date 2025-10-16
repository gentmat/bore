/**
 * Structured Logging Utility
 * Provides consistent, parseable logging across the application
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  constructor(context = 'app') {
    this.context = context;
  }

  /**
   * Format log message with timestamp and metadata
   */
  format(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...metadata
    };

    // In production, output JSON for log aggregation tools
    // In development, output human-readable format
    if (NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    } else {
      const metaStr = Object.keys(metadata).length > 0 
        ? ' ' + JSON.stringify(metadata, null, 2)
        : '';
      return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${this.context}] ${message}${metaStr}`;
    }
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, metadata));
    }
  }

  /**
   * Info level - general informational messages
   */
  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, metadata));
    }
  }

  /**
   * Warn level - warning messages
   */
  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, metadata));
    }
  }

  /**
   * Error level - error messages
   */
  error(message, error = null, metadata = {}) {
    if (this.shouldLog('error')) {
      const errorMeta = error ? {
        error: {
          message: error.message,
          stack: error.stack,
          ...metadata
        }
      } : metadata;
      console.error(this.format('error', message, errorMeta));
    }
  }

  /**
   * HTTP request logging
   */
  http(req, res, duration) {
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id,
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    if (req.user) {
      logData.userId = req.user.user_id;
    }

    const level = res.statusCode >= 500 ? 'error' : 
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    this[level](`${req.method} ${req.path}`, logData);
  }

  /**
   * Database query logging
   */
  query(query, duration, error = null) {
    if (error) {
      this.error('Database query failed', error, { 
        query: query.substring(0, 100),
        duration: `${duration}ms` 
      });
    } else {
      this.debug('Database query executed', { 
        query: query.substring(0, 100),
        duration: `${duration}ms` 
      });
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`);
  }
}

// Create default logger instance
const logger = new Logger('app');

// Export both the class and default instance
module.exports = {
  Logger,
  logger,
  // Convenience exports for common contexts
  createLogger: (context) => new Logger(context)
};
