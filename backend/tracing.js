/**
 * Distributed Tracing with OpenTelemetry
 * Provides request tracing across microservices
 */

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg');
const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis-4');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
const config = require('./config');
const { logger } = require('./utils/logger');

/**
 * Initialize OpenTelemetry tracing
 * @param {string} serviceName - Name of the service
 * @returns {NodeTracerProvider} Tracer provider instance
 */
function initializeTracing(serviceName = 'bore-backend') {
  try {
    // Skip if disabled
    if (process.env.TRACING_ENABLED !== 'true') {
      logger.info('🔍 Distributed tracing disabled');
      return null;
    }

    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.server.nodeEnv,
      }),
    });

    // Configure exporter
    let exporter;
    const exporterType = process.env.TRACE_EXPORTER || 'console';

    if (exporterType === 'jaeger') {
      // Jaeger exporter for production
      exporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        serviceName,
      });
      logger.info(`🔍 Tracing to Jaeger: ${process.env.JAEGER_ENDPOINT || 'http://localhost:14268'}`);
    } else {
      // Console exporter for development
      exporter = new ConsoleSpanExporter();
      logger.info('🔍 Tracing to console (development mode)');
    }

    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register the provider
    provider.register();

    // Register instrumentations
    registerInstrumentations({
      instrumentations: [
        // HTTP instrumentation for all HTTP requests
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttribute('http.request_id', request.headers['x-request-id']);
          },
        }),
        // Express instrumentation for route tracing
        new ExpressInstrumentation({
          requestHook: (span, info) => {
            span.updateName(`${info.request.method} ${info.layerType}`);
          },
        }),
        // PostgreSQL instrumentation
        new PgInstrumentation({
          enhancedDatabaseReporting: true,
        }),
        // Redis instrumentation
        new RedisInstrumentation(),
      ],
    });

    logger.info('✅ Distributed tracing initialized');
    return provider;
  } catch (error) {
    logger.warn('⚠️  Failed to initialize tracing (optional dependencies may be missing)', {
      error: error.message
    });
    logger.info('💡 To enable tracing, install: npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/instrumentation @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express @opentelemetry/instrumentation-pg @opentelemetry/instrumentation-redis-4 @opentelemetry/exporter-jaeger');
    return null;
  }
}

/**
 * Create custom span for business logic
 * @param {string} name - Span name
 * @param {Function} fn - Function to trace
 * @param {Object} attributes - Custom attributes
 */
async function trace(name, fn, attributes = {}) {
  try {
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer('bore-backend');
    
    return await tracer.startActiveSpan(name, async (span) => {
      try {
        // Add custom attributes
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });

        const result = await fn(span);
        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  } catch (error) {
    // Tracing not available, just execute the function
    return await fn();
  }
}

/**
 * Middleware to add trace context to logs
 */
function traceContextMiddleware(req, res, next) {
  try {
    const { trace, context } = require('@opentelemetry/api');
    const span = trace.getSpan(context.active());
    
    if (span) {
      const spanContext = span.spanContext();
      req.traceId = spanContext.traceId;
      req.spanId = spanContext.spanId;
    }
  } catch (error) {
    // Tracing not available, skip
  }
  next();
}

/**
 * Gracefully shutdown tracing
 */
async function shutdownTracing(provider) {
  if (provider) {
    try {
      await provider.shutdown();
      logger.info('✅ Tracing shutdown complete');
    } catch (error) {
      logger.error('Failed to shutdown tracing', error);
    }
  }
}

module.exports = {
  initializeTracing,
  shutdownTracing,
  trace,
  traceContextMiddleware
};
