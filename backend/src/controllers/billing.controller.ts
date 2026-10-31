// src/controllers/billing.controller.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BillingEngine } from '../services/billingEngine.service.js';
import { billingRepo } from '../repositories/billingRepo.js';

export default async function billingController(fastify: FastifyInstance) {
  const billingEngine = new BillingEngine(fastify);

  /**
   * Billing Cockpit: Dry Run / Preview[cite: 1]
   * Displays subscriptions due and expected invoice amounts before committing[cite: 1].
   */
  fastify.get('/api/billing/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { targetDate } = request.query as { targetDate: string };
    
    const dbClient = await fastify.db.getClient();
    try {
      const candidates = await billingRepo.getDueSubscriptions(dbClient, targetDate);
      
      // Calculate expected revenue for the preview[cite: 1]
      let expectedRevenue = 0;
      candidates.forEach(sub => {
        expectedRevenue += parseInt(sub.plan_price, 10);
      });

      return reply.send({
        subscriptionsDue: candidates.length,
        expectedRevenue,
        candidates
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to generate billing preview' });
    } finally {
      dbClient.release();
    }
  });

  /**
   * Commit the billing run[cite: 1]
   * Executes the batch loop and safely traps duplicates[cite: 1, 4].
   */
  fastify.post('/api/billing/run', {
    schema: {
      body: {
        type: 'object',
        required: ['targetDate', 'runNumber'],
        properties: {
          targetDate: { type: 'string' },
          runNumber: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { targetDate, runNumber } = request.body as { targetDate: string; runNumber: string };

    try {
      const result = await billingEngine.runBillingBatch(targetDate, runNumber);
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Billing run failed' });
    }
  });
}