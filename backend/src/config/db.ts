
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { FastifyPluginAsync } from 'fastify';
import 'dotenv/config';

// Augment FastifyInstance to recognize the db decorator
declare module 'fastify' {
  interface FastifyInstance {
    db: {
      query: (text: string, params?: any[]) => Promise<any>;
      getClient: () => Promise<any>;
    };
  }
}

const dbConnector: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for Neon DB[cite: 4]
  });

  fastify.decorate('db', {
    query: (text: string, params?: any[]) => pool.query(text, params),
    getClient: () => pool.connect(), 
  });

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
};

export default fp(dbConnector);