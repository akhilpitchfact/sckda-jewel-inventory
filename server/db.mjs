// server/db.mjs
// SQLite database (Node's built-in node:sqlite, no native build needed).
// One file on disk: DATA_DIR/jewel.db. Photos live next to it in DATA_DIR/photos.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const PHOTO_DIR = path.join(DATA_DIR, 'photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'jewel.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  designation TEXT,
  mobile TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin','inventory','verifier','accounts','management')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metal TEXT NOT NULL CHECK (metal IN ('gold','silver')),
  name TEXT NOT NULL,
  name_kn TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 100,
  UNIQUE (metal, name)
);

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_no TEXT NOT NULL UNIQUE,
  metal TEXT NOT NULL CHECK (metal IN ('gold','silver')),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  article_type TEXT,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  gross_weight REAL NOT NULL CHECK (gross_weight > 0),
  net_weight REAL,
  purity TEXT,
  purity_remarks TEXT,
  source TEXT NOT NULL CHECK (source IN ('hundi','seva')),
  receipt_ref TEXT,
  received_at TEXT NOT NULL,
  donor_name TEXT,
  donor_mobile TEXT,
  donor_address TEXT,
  remarks TEXT,
  weighed_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','returned','approved','cancelled')),
  return_remarks TEXT,
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  verification_remarks TEXT,
  cancel_reason TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_received ON articles(received_at);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_metal ON articles(metal);

CREATE TABLE IF NOT EXISTS article_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  line_no INTEGER NOT NULL,
  description TEXT,
  weight REAL NOT NULL CHECK (weight > 0)
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  caption TEXT,
  removed INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL
);

-- Append-only audit trail. Triggers below block UPDATE and DELETE.
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  article_no TEXT,
  details TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_article ON audit(article_no);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);

CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

-- Articles are never deleted (approved ones are cancelled with a reason instead).
CREATE TRIGGER IF NOT EXISTS articles_no_delete BEFORE DELETE ON articles
BEGIN SELECT RAISE(ABORT, 'articles cannot be deleted'); END;
`);

// Default categories from the proposal (section 3.3). Authority can add more.
const DEFAULT_CATEGORIES = {
  gold: [
    ['Gold Coins', 'ಚಿನ್ನದ ನಾಣ್ಯಗಳು'],
    ['Gold Chains', 'ಚಿನ್ನದ ಸರಗಳು'],
    ['Gold Rings', 'ಚಿನ್ನದ ಉಂಗುರಗಳು'],
    ['Gold Necklaces', 'ಚಿನ್ನದ ನೆಕ್ಲೇಸ್‌ಗಳು'],
    ['Gold Bangles', 'ಚಿನ್ನದ ಬಳೆಗಳು'],
    ['Gold Pendants', 'ಚಿನ್ನದ ಪದಕಗಳು'],
    ['Gold Ornaments', 'ಚಿನ್ನದ ಆಭರಣಗಳು'],
    ['Other Gold Articles', 'ಇತರ ಚಿನ್ನದ ವಸ್ತುಗಳು'],
  ],
  silver: [
    ['Silver Coins', 'ಬೆಳ್ಳಿ ನಾಣ್ಯಗಳು'],
    ['Silver Vessels', 'ಬೆಳ್ಳಿ ಪಾತ್ರೆಗಳು'],
    ['Silver Lamps', 'ಬೆಳ್ಳಿ ದೀಪಗಳು'],
    ['Silver Ornaments', 'ಬೆಳ್ಳಿ ಆಭರಣಗಳು'],
    ['Silver Articles', 'ಬೆಳ್ಳಿ ವಸ್ತುಗಳು'],
    ['Silver Utensils', 'ಬೆಳ್ಳಿ ಪಾತ್ರೆ-ಪರಿಕರಗಳು'],
    ['Other Silver Articles', 'ಇತರ ಬೆಳ್ಳಿ ವಸ್ತುಗಳು'],
  ],
};

const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
if (catCount === 0) {
  const ins = db.prepare('INSERT INTO categories (metal, name, name_kn, sort) VALUES (?, ?, ?, ?)');
  for (const metal of ['gold', 'silver']) {
    DEFAULT_CATEGORIES[metal].forEach(([en, kn], i) => ins.run(metal, en, kn, (i + 1) * 10));
  }
}

export function nowIso() {
  return new Date().toISOString();
}

/** Run fn inside a transaction (node:sqlite has no helper). */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Next article number, e.g. AU-2026-00001 (gold) / AG-2026-00001 (silver). Call inside tx(). */
export function nextArticleNo(metal, receivedAtIso) {
  const year = String(receivedAtIso).slice(0, 4);
  const prefix = metal === 'gold' ? 'AU' : 'AG';
  const key = `${prefix}-${year}`;
  db.prepare('INSERT INTO counters (key, value) VALUES (?, 0) ON CONFLICT(key) DO NOTHING').run(key);
  db.prepare('UPDATE counters SET value = value + 1 WHERE key = ?').run(key);
  const n = db.prepare('SELECT value FROM counters WHERE key = ?').get(key).value;
  return `${key}-${String(n).padStart(5, '0')}`;
}

export function audit(req, action, entity, entityId, articleNo, details) {
  const u = req?.user;
  db.prepare(
    `INSERT INTO audit (at, user_id, user_name, user_role, action, entity, entity_id, article_no, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nowIso(),
    u?.id ?? null,
    u?.name ?? null,
    u?.role ?? null,
    action,
    entity,
    entityId ?? null,
    articleNo ?? null,
    details ? JSON.stringify(details) : null,
    req?.ip ?? null,
  );
}
