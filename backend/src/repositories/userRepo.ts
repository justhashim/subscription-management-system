// src/repositories/userRepo.ts
import type { Db } from '../utils/errors.js';

const USER_SELECT = `
  SELECT u.id, u.full_name, u.email, u.status, r.name AS role
  FROM users u
  JOIN roles r ON r.id = u.role_id`;

export const userRepo = {
  async getRoleId(db: Db, name: string): Promise<string | null> {
    const result = await db.query(`SELECT id FROM roles WHERE name = $1`, [name]);
    return result.rows[0]?.id ?? null;
  },

  async ensureRoles(db: Db) {
    await db.query(
      `INSERT INTO roles (name, description) VALUES
         ('admin', 'Full system access'),
         ('staff', 'Day-to-day operations with limited access'),
         ('customer', 'Customer portal access')
       ON CONFLICT (name) DO NOTHING`
    );
  },

  /** User with role and local password hash (null when the user has no local login). */
  async findByEmail(db: Db, email: string) {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.status, r.name AS role, a.password_hash
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN auth_accounts a ON a.user_id = u.id AND a.provider = 'local'
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] ?? null;
  },

  async findById(db: Db, id: string) {
    const result = await db.query(`${USER_SELECT} WHERE u.id = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async createUser(db: Db, fullName: string, email: string, roleId: string) {
    const result = await db.query(
      `INSERT INTO users (full_name, email, role_id) VALUES ($1, $2, $3) RETURNING id`,
      [fullName, email, roleId]
    );
    return result.rows[0].id as string;
  },

  async createLocalAccount(db: Db, userId: string, passwordHash: string) {
    await db.query(
      `INSERT INTO auth_accounts (user_id, provider, password_hash) VALUES ($1, 'local', $2)`,
      [userId, passwordHash]
    );
  },

  async createCustomer(db: Db, name: string, type: 'individual' | 'business', email: string) {
    const result = await db.query(
      `INSERT INTO customers (customer_name, customer_type, email) VALUES ($1, $2, $3) RETURNING id`,
      [name, type, email]
    );
    return result.rows[0].id as string;
  },

  async addMembership(db: Db, customerId: string, userId: string, role: 'owner' | 'manager' | 'member', isPrimary: boolean) {
    await db.query(
      `INSERT INTO customer_users (customer_id, user_id, membership_role, is_primary) VALUES ($1, $2, $3, $4)`,
      [customerId, userId, role, isPrimary]
    );
  },

  async memberships(db: Db, userId: string) {
    const result = await db.query(
      `SELECT cu.customer_id, c.customer_name, cu.membership_role, cu.is_primary
       FROM customer_users cu
       JOIN customers c ON c.id = cu.customer_id
       WHERE cu.user_id = $1
       ORDER BY cu.joined_at ASC`,
      [userId]
    );
    return result.rows as {
      customer_id: string; customer_name: string; membership_role: string; is_primary: boolean;
    }[];
  },

  async setResetToken(db: Db, userId: string, tokenHash: string, expiresAt: Date) {
    await db.query(
      `UPDATE auth_accounts SET reset_token_hash = $2, reset_token_expires_at = $3
       WHERE user_id = $1 AND provider = 'local'`,
      [userId, tokenHash, expiresAt.toISOString()]
    );
  },

  async findUserIdByResetToken(db: Db, tokenHash: string): Promise<string | null> {
    const result = await db.query(
      `SELECT user_id FROM auth_accounts
       WHERE provider = 'local' AND reset_token_hash = $1 AND reset_token_expires_at > now()`,
      [tokenHash]
    );
    return result.rows[0]?.user_id ?? null;
  },

  async setPassword(db: Db, userId: string, passwordHash: string) {
    await db.query(
      `UPDATE auth_accounts
       SET password_hash = $2, reset_token_hash = NULL, reset_token_expires_at = NULL
       WHERE user_id = $1 AND provider = 'local'`,
      [userId, passwordHash]
    );
  },

  async listStaff(db: Db) {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.status, r.name AS role, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('admin', 'staff')
       ORDER BY u.created_at ASC`
    );
    return result.rows;
  },

  async getCustomer(db: Db, id: string) {
    const result = await db.query(`SELECT id, customer_name, status FROM customers WHERE id = $1`, [id]);
    return (result.rows[0] ?? null) as { id: string; customer_name: string; status: string } | null;
  },

  async listCustomers(db: Db, q: string | undefined, limit: number, offset: number) {
    const params: unknown[] = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE customer_name ILIKE $1 OR email ILIKE $1`;
    }
    params.push(limit, offset);
    const result = await db.query(
      `SELECT id, customer_name, customer_type, email, phone, status, created_at
       FROM customers ${where}
       ORDER BY customer_name ASC, id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }
};
