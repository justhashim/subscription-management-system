// src/scripts/seedAdmin.ts
// Seeds the three roles and creates the first admin.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] npm run seed:admin
import Fastify from 'fastify';
import bcrypt from 'bcryptjs';
import dbConnector from '../config/db.js';
import { userRepo } from '../repositories/userRepo.js';
import { assertPasswordRules, normalizeEmail } from '../services/auth.service.js';
import { withTransaction } from '../utils/errors.js';

async function main() {
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!rawEmail || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME)');
  }
  assertPasswordRules(password);

  const email = normalizeEmail(rawEmail);
  const app = Fastify();
  await app.register(dbConnector);
  await app.ready();

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await withTransaction(app, async (tx) => {
    await userRepo.ensureRoles(tx);
    if (await userRepo.findByEmail(tx, email)) return false;

    const roleId = await userRepo.getRoleId(tx, 'admin');
    if (!roleId) throw new Error('Admin role missing');
    const userId = await userRepo.createUser(tx, process.env.ADMIN_NAME ?? 'Administrator', email, roleId);
    await userRepo.createLocalAccount(tx, userId, passwordHash);
    return true;
  });

  console.log(created ? `Admin created: ${email}` : `Roles ensured. User ${email} already exists.`);
  await app.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
