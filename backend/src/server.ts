// src/server.ts
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dbConnector from './config/db.js';
import authPlugin from './plugins/auth.plugin.js';
import { registerErrorHandler } from './utils/errors.js';
import { SubscriptionService } from './services/subscription.service.js';
import authController from './controllers/auth.controller.js';
import usersController from './controllers/users.controller.js';
import customersController from './controllers/customers.controller.js';
import productsController from './controllers/products.controller.js';
import plansController from './controllers/plans.controller.js';
import subscriptionsController from './controllers/subscriptions.controller.js';
import quotationsController from './controllers/quotations.controller.js';
import billingController from './controllers/billing.controller.js';
import invoicesController from './controllers/invoice.controller.js';
import discountsController from './controllers/discounts.controller.js';
import operationsController from './controllers/operations.controller.js';
import paymentsController from './controllers/payments.controller.js';

const fastify = Fastify({ logger: true });

const start = async () => {
  try {
    // Must be set before the plugins below so every route uses it.
    registerErrorHandler(fastify);

    // 1. Swagger
    await fastify.register(swagger, {
      swagger: {
        info: {
          title: 'Brightloop API',
          description: 'Authentication, catalogue, subscriptions, billing and invoices',
          version: '1.0.0'
        }
      }
    });
    await fastify.register(swaggerUi, { routePrefix: '/docs' });

    // 2. Database and authentication (must come before the controllers that use their decorators)
    await fastify.register(dbConnector);
    await fastify.register(authPlugin);

    // 3. Member 2: auth, users, catalogue, subscriptions, quotations
    await fastify.register(authController);
    await fastify.register(usersController);
    await fastify.register(customersController);
    await fastify.register(productsController);
    await fastify.register(plansController);
    await fastify.register(subscriptionsController);
    await fastify.register(quotationsController);

    // 4. Member 3: billing, invoices, discounts
    await fastify.register(billingController);
    await fastify.register(invoicesController);
    await fastify.register(discountsController);
    await fastify.register(operationsController);
    await fastify.register(paymentsController);

    await fastify.listen({ port: 3000, host: '0.0.0.0' });

    // Plans with auto_close: close subscriptions past their end date, once an hour.
    const subscriptions = new SubscriptionService(fastify);
    setInterval(() => {
      subscriptions.closeExpired().catch((error) => fastify.log.error(error));
    }, 60 * 60 * 1000).unref();

    fastify.log.info(`Server running at http://localhost:3000`);
    fastify.log.info(`Swagger UI ready at http://localhost:3000/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
