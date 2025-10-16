/**
 * Swagger/OpenAPI Documentation Setup
 * Serves interactive API documentation
 */

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

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

export {
  swaggerUi,
  swaggerDocument,
  swaggerOptions
};
