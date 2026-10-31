// src/services/auth.service.ts
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { userRepo } from '../repositories/userRepo.js';
import { AppError, withTransaction, type Db } from '../utils/errors.js';
import { sendResetEmail } from './mailer.service.js';

/** More than 8 characters, with an uppercase letter, a lowercase letter and a special character. */
export function assertPasswordRules(password: string): void {
  if (
    typeof password !== 'string' ||
    password.length <= 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new AppError(
      400,
      'Password must be more than 8 characters and include an uppercase letter, a lowercase letter and a special character'
    );
  }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  customerName?: string;
  customerType?: 'individual' | 'business';
}

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  private async tokenFor(db: Db, user: { id: string; role: string }) {
    const memberships = await userRepo.memberships(db, user.id);
    return this.app.jwt.sign({
      sub: user.id,
      role: user.role as 'admin' | 'staff' | 'customer',
      customerIds: memberships.map((m) => m.customer_id)
    });
  }

  /** Public sign-up. Always creates a `customer` login plus its own customer account. */
  async register(input: RegisterInput) {
    assertPasswordRules(input.password);
    const email = normalizeEmail(input.email);
    const fullName = input.fullName.trim();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const userId = await withTransaction(this.app, async (tx) => {
      if (await userRepo.findByEmail(tx, email)) {
        throw new AppError(409, 'An account with this email already exists');
      }
      const roleId = await userRepo.getRoleId(tx, 'customer');
      if (!roleId) throw new AppError(500, 'Roles are not seeded. Run: npm run seed:admin');

      const id = await userRepo.createUser(tx, fullName, email, roleId);
      await userRepo.createLocalAccount(tx, id, passwordHash);
      const customerId = await userRepo.createCustomer(
        tx, input.customerName?.trim() || fullName, input.customerType ?? 'individual', email
      );
      await userRepo.addMembership(tx, customerId, id, 'owner', true);
      return id;
    });

    return this.sessionFor(userId);
  }

  async login(emailInput: string, password: string) {
    const user = await userRepo.findByEmail(this.app.db, normalizeEmail(emailInput));
    const valid = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid) throw new AppError(401, 'Invalid email or password');
    if (user.status !== 'active') throw new AppError(403, 'This account is not active');
    return this.sessionFor(user.id);
  }

  private async sessionFor(userId: string) {
    const user = await userRepo.findById(this.app.db, userId);
    if (!user) throw new AppError(404, 'User not found');
    return { token: await this.tokenFor(this.app.db, user), user };
  }

  async me(userId: string) {
    const user = await userRepo.findById(this.app.db, userId);
    if (!user) throw new AppError(404, 'User not found');
    return { ...user, customers: await userRepo.memberships(this.app.db, userId) };
  }

  /** Always succeeds from the caller's view, so it cannot be used to discover which emails exist. */
  async forgotPassword(emailInput: string): Promise<void> {
    const user = await userRepo.findByEmail(this.app.db, normalizeEmail(emailInput));
    if (!user || !user.password_hash || user.status !== 'active') return;

    const token = randomBytes(32).toString('hex');
    await userRepo.setResetToken(this.app.db, user.id, sha256(token), new Date(Date.now() + 60 * 60 * 1000));

    const base = process.env.APP_URL ?? 'http://localhost:5173';
    try {
      await sendResetEmail(this.app, user.email, `${base}/reset-password?token=${token}`);
    } catch (error) {
      this.app.log.error(error, 'Failed to send password reset email');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    assertPasswordRules(newPassword);
    const userId = await userRepo.findUserIdByResetToken(this.app.db, sha256(token));
    if (!userId) throw new AppError(400, 'Reset link is invalid or has expired');
    await userRepo.setPassword(this.app.db, userId, await bcrypt.hash(newPassword, 10));
  }

  /** Admin only (enforced by the route): creates a staff login. */
  async addStaff(input: { fullName: string; email: string; password: string }) {
    assertPasswordRules(input.password);
    const email = normalizeEmail(input.email);
    const passwordHash = await bcrypt.hash(input.password, 10);

    const id = await withTransaction(this.app, async (tx) => {
      if (await userRepo.findByEmail(tx, email)) {
        throw new AppError(409, 'An account with this email already exists');
      }
      const roleId = await userRepo.getRoleId(tx, 'staff');
      if (!roleId) throw new AppError(500, 'Roles are not seeded. Run: npm run seed:admin');
      const userId = await userRepo.createUser(tx, input.fullName.trim(), email, roleId);
      await userRepo.createLocalAccount(tx, userId, passwordHash);
      return userId;
    });
    return userRepo.findById(this.app.db, id);
  }
}
