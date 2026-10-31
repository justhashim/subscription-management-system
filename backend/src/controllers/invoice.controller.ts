// src/controllers/invoices.controller.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function invoicesController(fastify: FastifyInstance) {
  
  /**
   * Fetch paginated invoices for the finance dashboard[cite: 8]
   * Keysets or limits should be used to ensure sub-2-second response times[cite: 4, 8].
   */
  fastify.get('/api/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit = 50, offset = 0 } = request.query as any;
    
    let query = `SELECT id, invoice_number, status, total_amount, due_date FROM invoices`;
    let params: any[] = [];
    
    if (status) {
      query += ` WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params = [status, limit, offset];
    } else {
      query += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      params = [limit, offset];
    }

    try {
      const { rows } = await fastify.db.query(query, params);
      return reply.send({ data: rows });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to fetch invoices' });
    }
  });

  /**
   * Void an issued invoice[cite: 1, 4]
   * Corrections require void-and-reissue rather than editing[cite: 1].
   */
  fastify.post('/api/invoices/:id/void', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const dbClient = await fastify.db.getClient();
    
    try {
      await dbClient.query('BEGIN');
      
      // Update invoice status to void[cite: 4]
      await dbClient.query(`UPDATE invoices SET status = 'void' WHERE id = $1`, [id]);
      
      // In a full implementation, you would also release claimed discount quotas here[cite: 2]
      
      await dbClient.query('COMMIT');
      return reply.send({ success: true, message: 'Invoice voided successfully' });
    } catch (error) {
      await dbClient.query('ROLLBACK');
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to void invoice' });
    } finally {
      dbClient.release();
    }
  });
}