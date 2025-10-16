/**
 * Swagger/OpenAPI Documentation Setup
 * Serves interactive API documentation
 */

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Bore API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
};

module.exports = {
  swaggerUi,
  swaggerDocument,
  swaggerOptions
};
