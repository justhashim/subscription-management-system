
// src/server.ts
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dbConnector from './config/db.js';
import billingController from './controllers/billing.controller.js';
import invoicesController from './controllers/invoice.controller.js';
import discountsController from './controllers/discounts.controller.js';

const fastify = Fastify({ logger: true });

const start = async () => {
  try {
    // 1. Register Swagger
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'Brightloop Billing API',
          description: 'Member 3 - Billing Engine & Invoices',
          version: '1.0.0'
        }
      }
    });

    // 2. Register Swagger UI
    await fastify.register(swaggerUi, {
      routePrefix: '/docs', // This is the URL where you will access the UI
    });

    // 3. Register Database and Controllers
    await fastify.register(dbConnector);
    await fastify.register(billingController);
    await fastify.register(invoicesController);
    await fastify.register(discountsController);

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    
    fastify.log.info(`Server running at http://localhost:3000`);
    fastify.log.info(`Swagger UI ready at http://localhost:3000/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();