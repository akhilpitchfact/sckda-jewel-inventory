// server/auth.mjs
// Password hashing (scrypt), cookie sessions, role checks.

import crypto from 'node:crypto';
import { db, nowIso, audit } from './db.mjs';

export const ROLES = ['superadmin', 'inventory', 'verifier', 'accounts', 'management'];

// What each role may do. The UI reads the same list from /api/me.
export const PERMISSIONS = {
  superadmin: ['article.create', 'article.edit', 'article.verify', 'article.amend', 'article.cancel',
    'donor.view', 'reports.view', 'audit.view', 'users.manage', 'settings.manage'],
  inventory: ['article.create', 'article.edit', 'donor.view'],
  verifier: ['article.verify', 'donor.view', 'reports.view'],
  accounts: ['donor.view', 'reports.view', 'audit.view'],
  management: ['reports.view', 'audit.view'],
};

export function can(user, perm) {
  return !!user && (PERMISSIONS[user.role] || []).includes(perm);
}

const SESSION_COOKIE = 'sckda_jewel_sid';
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES || 60);
const MAX_HOURS = Number(process.env.SESSION_MAX_HOURS || 12);

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers';
  return null;
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(res, req, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + MAX_HOURS * 3600_000);
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, last_seen, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)',
  ).run(sha(token), user.id, now.toISOString(), now.toISOString(), expires.toISOString(), req.ip,
    String(req.headers['user-agent'] || '').slice(0, 200));
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE !== 'false',
    maxAge: MAX_HOURS * 3600_000,
    path: '/',
  });
}

export function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function destroyUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/** Express middleware: attaches req.user when a valid session cookie is present. */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  const row = db.prepare(
    `SELECT s.token_hash, s.last_seen, s.expires_at, u.id, u.username, u.name, u.designation, u.role,
            u.active, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  ).get(sha(token));
  if (!row) return next();
  const now = Date.now();
  const idleExpired = now - Date.parse(row.last_seen) > IDLE_MINUTES * 60_000;
  if (!row.active || idleExpired || now > Date.parse(row.expires_at)) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return next();
  }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(nowIso(), row.token_hash);
  req.user = {
    id: row.id, username: row.username, name: row.name, designation: row.designation,
    role: row.role, mustChangePassword: !!row.must_change_password,
  };
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  // Until the temporary password is changed, only the password + me + logout routes work.
  if (req.user.mustChangePassword && !req.path.startsWith('/auth/')) {
    return res.status(403).json({ error: 'Change your password first', code: 'MUST_CHANGE_PASSWORD' });
  }
  next();
}

export function requirePerm(perm) {
  return (req, res, next) => {
    if (!can(req.user, perm)) return res.status(403).json({ error: 'You do not have permission for this' });
    next();
  };
}

// Simple in-memory login throttle per IP (account lockout is stored in the DB).
const ipAttempts = new Map();
export function loginThrottle(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const rec = ipAttempts.get(key) || { n: 0, t: now };
  if (now - rec.t > 15 * 60_000) { rec.n = 0; rec.t = now; }
  rec.n += 1;
  ipAttempts.set(key, rec);
  if (rec.n > 30) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  next();
}

/** On first start with an empty users table, create the Super Administrator. */
export function bootstrapSuperAdmin() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (n > 0) return;
  const username = process.env.ADMIN_USERNAME || 'superadmin';
  let password = process.env.ADMIN_PASSWORD;
  if (!password) password = crypto.randomBytes(6).toString('base64url') + '9a';
  db.prepare(
    `INSERT INTO users (username, name, designation, role, password_hash, must_change_password, created_at)
     VALUES (?, ?, ?, 'superadmin', ?, 1, ?)`,
  ).run(username, process.env.ADMIN_NAME || 'Secretary', 'Secretary, SCKDA', hashPassword(password), nowIso());
  audit(null, 'user.bootstrap', 'user', null, null, { username });
  console.log('────────────────────────────────────────────────────────');
  console.log(' First start: Super Administrator created');
  console.log(`   username: ${username}`);
  if (!process.env.ADMIN_PASSWORD) console.log(`   temporary password: ${password}`);
  console.log(' You will be asked to change the password at first login.');
  console.log('────────────────────────────────────────────────────────');
}
