// server/index.mjs
// SCKDA Gold & Silver Articles Inventory — API + static PWA server.
// Run: node server/index.mjs   (env: PORT, DATA_DIR, ADMIN_USERNAME, ADMIN_PASSWORD, COOKIE_SECURE)

import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, tx, nowIso, nextArticleNo, audit, PHOTO_DIR } from './db.mjs';
import {
  ROLES, PERMISSIONS, can, hashPassword, verifyPassword, passwordProblem, createSession,
  destroySession, destroyUserSessions, loadUser, requireAuth, requirePerm, loginThrottle,
  bootstrapSuperAdmin,
} from './auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const app = express();

const tp = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', tp === 'true' ? true : /^\d+$/.test(tp) ? Number(tp) : tp);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(loadUser);

// CSRF guard: every state-changing API call must carry this header (set by the app's fetch wrapper).
// Combined with SameSite=Strict cookies, cross-site forms cannot act as a logged-in user.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'sckda-jewel') {
    return res.status(400).json({ error: 'Bad request' });
  }
  next();
});

const api = express.Router();
app.use('/api', api);

// ── helpers ────────────────────────────────────────────────────────────────
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max = 500) => (v == null ? null : String(v).trim().slice(0, max) || null);
const num = (v) => (v === '' || v == null ? null : Number(v));

const ARTICLE_SELECT = `
  SELECT a.*, c.name AS category_name, c.name_kn AS category_name_kn,
         cu.name AS created_by_name, uu.name AS updated_by_name, vu.name AS verified_by_name,
         (SELECT COUNT(*) FROM photos p WHERE p.article_id = a.id AND p.removed = 0) AS photo_count,
         (SELECT p.id FROM photos p WHERE p.article_id = a.id AND p.removed = 0 ORDER BY p.id LIMIT 1) AS cover_photo_id
    FROM articles a
    JOIN categories c ON c.id = a.category_id
    JOIN users cu ON cu.id = a.created_by
    LEFT JOIN users uu ON uu.id = a.updated_by
    LEFT JOIN users vu ON vu.id = a.verified_by`;

/** Hide donor details from roles that may not see them (proposal §7). */
function redact(user, a) {
  if (!a || can(user, 'donor.view')) return a;
  const hasDonor = !!(a.donor_name || a.donor_mobile || a.donor_address);
  return { ...a, donor_name: hasDonor ? '•••' : null, donor_mobile: null, donor_address: null, donor_hidden: true };
}

const EDITABLE_FIELDS = ['metal', 'category_id', 'article_type', 'description', 'quantity', 'gross_weight',
  'net_weight', 'purity', 'purity_remarks', 'source', 'receipt_ref', 'received_at', 'donor_name',
  'donor_mobile', 'donor_address', 'remarks', 'weighed_by'];

function parseArticle(body) {
  const a = {
    metal: body.metal,
    category_id: Number(body.category_id),
    article_type: str(body.article_type, 100),
    description: str(body.description, 1000),
    quantity: Number(body.quantity),
    gross_weight: num(body.gross_weight),
    net_weight: num(body.net_weight),
    purity: str(body.purity, 50),
    purity_remarks: str(body.purity_remarks, 500),
    source: body.source,
    receipt_ref: str(body.receipt_ref, 100),
    received_at: str(body.received_at, 40),
    donor_name: str(body.donor_name, 150),
    donor_mobile: str(body.donor_mobile, 20),
    donor_address: str(body.donor_address, 500),
    remarks: str(body.remarks, 1000),
    weighed_by: str(body.weighed_by, 150),
  };
  const items = Array.isArray(body.items) ? body.items
    .filter((it) => it && Number(it.weight) > 0)
    .slice(0, 200)
    .map((it, i) => ({ line_no: i + 1, description: str(it.description, 200), weight: Number(it.weight) })) : [];

  if (!['gold', 'silver'].includes(a.metal)) return { error: 'Choose Gold or Silver' };
  if (!['hundi', 'seva'].includes(a.source)) return { error: 'Choose the source: Hundi or Seva' };
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(a.category_id);
  if (!cat || cat.metal !== a.metal) return { error: 'Choose a category for this metal' };
  if (!a.description) return { error: 'Description is required' };
  if (!Number.isInteger(a.quantity) || a.quantity < 1 || a.quantity > 100000) return { error: 'Quantity must be a whole number of at least 1' };
  if (!(a.gross_weight > 0) || a.gross_weight > 1_000_000) return { error: 'Gross weight (grams) is required' };
  if (a.net_weight != null && (!(a.net_weight > 0) || a.net_weight > a.gross_weight)) return { error: 'Net weight must be more than 0 and not more than gross weight' };
  if (!a.received_at || Number.isNaN(Date.parse(a.received_at))) return { error: 'Date and time of receipt is required' };
  a.received_at = new Date(a.received_at).toISOString();
  if (Date.parse(a.received_at) > Date.now() + 5 * 60_000) return { error: 'Date of receipt cannot be in the future' };
  if (a.donor_mobile && !/^[0-9+\-\s]{6,20}$/.test(a.donor_mobile)) return { error: 'Donor mobile number looks wrong' };
  a.gross_weight = Math.round(a.gross_weight * 1000) / 1000;
  if (a.net_weight != null) a.net_weight = Math.round(a.net_weight * 1000) / 1000;
  return { a, items };
}

function diff(before, after) {
  const changes = {};
  for (const k of EDITABLE_FIELDS) {
    const b = before[k] ?? null;
    const n = after[k] ?? null;
    if (String(b) !== String(n)) changes[k] = { from: b, to: n };
  }
  return changes;
}

function getArticle(idOrNo) {
  const byNo = /^[A-Z]{2}-\d{4}-\d+$/.test(String(idOrNo));
  return db.prepare(`${ARTICLE_SELECT} WHERE ${byNo ? 'a.article_no' : 'a.id'} = ?`).get(byNo ? idOrNo : Number(idOrNo));
}

function replaceItems(articleId, items) {
  db.prepare('DELETE FROM article_items WHERE article_id = ?').run(articleId);
  const ins = db.prepare('INSERT INTO article_items (article_id, line_no, description, weight) VALUES (?,?,?,?)');
  for (const it of items) ins.run(articleId, it.line_no, it.description, it.weight);
}

// ── auth routes ────────────────────────────────────────────────────────────
api.post('/auth/login', loginThrottle, (req, res) => {
  const username = str(req.body?.username, 60);
  const password = String(req.body?.password || '');
  const u = username && db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (u?.locked_until && Date.parse(u.locked_until) > Date.now()) {
    return bad(res, 'Account locked after repeated wrong passwords. Try again in 15 minutes.', 423);
  }
  if (!u || !u.active || !verifyPassword(password, u.password_hash)) {
    if (u) {
      const fails = u.failed_logins + 1;
      const lock = fails >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
      db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : fails, lock, u.id);
      audit({ user: { id: u.id, name: u.name, role: u.role }, ip: req.ip }, 'auth.login_failed', 'user', u.id, null, lock ? { locked: true } : null);
    }
    return bad(res, 'Wrong username or password', 401);
  }
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(nowIso(), u.id);
  createSession(res, req, u);
  audit({ user: u, ip: req.ip }, 'auth.login', 'user', u.id, null, null);
  res.json({ ok: true });
});

api.post('/auth/logout', (req, res) => {
  if (req.user) audit(req, 'auth.logout', 'user', req.user.id, null, null);
  destroySession(req, res);
  res.json({ ok: true });
});

api.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  res.json({ user: req.user, permissions: PERMISSIONS[req.user.role] });
});

api.post('/auth/change-password', (req, res) => {
  if (!req.user) return bad(res, 'Please log in', 401);
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(current || ''), u.password_hash)) return bad(res, 'Current password is wrong');
  const p = passwordProblem(next);
  if (p) return bad(res, p);
  if (next === current) return bad(res, 'Choose a different password');
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(next), u.id);
  destroyUserSessions(u.id);
  createSession(res, req, u);
  audit(req, 'auth.password_changed', 'user', u.id, null, null);
  res.json({ ok: true });
});

api.use(requireAuth);

// ── categories ─────────────────────────────────────────────────────────────
api.get('/categories', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY metal, sort, name').all());
});

api.post('/categories', requirePerm('settings.manage'), (req, res) => {
  const metal = req.body?.metal;
  const name = str(req.body?.name, 80);
  const nameKn = str(req.body?.name_kn, 80);
  if (!['gold', 'silver'].includes(metal) || !name) return bad(res, 'Metal and name are required');
  try {
    const r = db.prepare('INSERT INTO categories (metal, name, name_kn, sort) VALUES (?,?,?,(SELECT COALESCE(MAX(sort),0)+10 FROM categories WHERE metal = ?))')
      .run(metal, name, nameKn, metal);
    audit(req, 'category.create', 'category', Number(r.lastInsertRowid), null, { metal, name, name_kn: nameKn });
    res.json({ id: Number(r.lastInsertRowid) });
  } catch {
    bad(res, 'A category with this name already exists');
  }
});

api.patch('/categories/:id', requirePerm('settings.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
  if (!c) return bad(res, 'Not found', 404);
  const name = str(req.body?.name, 80) ?? c.name;
  const nameKn = req.body?.name_kn !== undefined ? str(req.body.name_kn, 80) : c.name_kn;
  const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : c.active;
  db.prepare('UPDATE categories SET name = ?, name_kn = ?, active = ? WHERE id = ?').run(name, nameKn, active, c.id);
  audit(req, 'category.update', 'category', c.id, null, { before: c, after: { name, name_kn: nameKn, active } });
  res.json({ ok: true });
});

// ── articles ───────────────────────────────────────────────────────────────
api.get('/articles', (req, res) => {
  const q = req.query;
  const where = [];
  const args = [];
  if (q.metal) { where.push('a.metal = ?'); args.push(q.metal); }
  if (q.source) { where.push('a.source = ?'); args.push(q.source); }
  if (q.status) {
    const st = String(q.status).split(',');
    where.push(`a.status IN (${st.map(() => '?').join(',')})`); args.push(...st);
  } else if (q.includeCancelled !== '1') {
    where.push("a.status != 'cancelled'");
  }
  if (q.category_id) { where.push('a.category_id = ?'); args.push(Number(q.category_id)); }
  if (q.from) { where.push('a.received_at >= ?'); args.push(new Date(q.from).toISOString()); }
  if (q.to) { where.push('a.received_at < ?'); args.push(new Date(q.to).toISOString()); }
  if (q.minWeight) { where.push('a.gross_weight >= ?'); args.push(Number(q.minWeight)); }
  if (q.maxWeight) { where.push('a.gross_weight <= ?'); args.push(Number(q.maxWeight)); }
  if (q.createdByMe === '1') { where.push('a.created_by = ?'); args.push(req.user.id); }
  if (q.search) {
    const s = `%${String(q.search).trim()}%`;
    const donorClause = can(req.user, 'donor.view') ? ' OR a.donor_name LIKE ? OR a.donor_mobile LIKE ?' : '';
    where.push(`(a.article_no LIKE ? OR a.description LIKE ? OR a.receipt_ref LIKE ? OR a.article_type LIKE ?${donorClause})`);
    args.push(s, s, s, s);
    if (donorClause) args.push(s, s);
  }
  const sql = `${ARTICLE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.received_at DESC, a.id DESC LIMIT ?`;
  args.push(Math.min(Number(q.limit) || 5000, 20000));
  const rows = db.prepare(sql).all(...args).map((a) => redact(req.user, a));
  res.json(rows);
});

api.get('/articles/:id', (req, res) => {
  const a = getArticle(req.params.id);
  if (!a) return bad(res, 'Article not found', 404);
  const items = db.prepare('SELECT * FROM article_items WHERE article_id = ? ORDER BY line_no').all(a.id);
  const photos = db.prepare(
    `SELECT p.id, p.caption, p.size, p.uploaded_at, u.name AS uploaded_by_name
       FROM photos p JOIN users u ON u.id = p.uploaded_by WHERE p.article_id = ? AND p.removed = 0 ORDER BY p.id`,
  ).all(a.id);
  const history = db.prepare('SELECT * FROM audit WHERE article_no = ? ORDER BY id').all(a.article_no)
    .map((h) => ({ ...h, details: h.details ? JSON.parse(h.details) : null }))
    .map((h) => (can(req.user, 'donor.view') ? h : redactHistory(h)));
  res.json({ article: redact(req.user, a), items, photos, history });
});

function redactHistory(h) {
  if (!h.details) return h;
  const d = JSON.parse(JSON.stringify(h.details));
  const scrub = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      if (k.startsWith('donor_')) o[k] = '•••';
      else scrub(o[k]);
    }
  };
  scrub(d);
  return { ...h, details: d };
}

api.post('/articles', requirePerm('article.create'), (req, res) => {
  const p = parseArticle(req.body || {});
  if (p.error) return bad(res, p.error);
  const { a, items } = p;
  const result = tx(() => {
    const articleNo = nextArticleNo(a.metal, a.received_at);
    const now = nowIso();
    const r = db.prepare(
      `INSERT INTO articles (article_no, ${EDITABLE_FIELDS.join(', ')}, status, created_by, created_at)
       VALUES (?, ${EDITABLE_FIELDS.map(() => '?').join(', ')}, 'pending', ?, ?)`,
    ).run(articleNo, ...EDITABLE_FIELDS.map((k) => a[k]), req.user.id, now);
    const id = Number(r.lastInsertRowid);
    replaceItems(id, items);
    audit(req, 'article.registered', 'article', id, articleNo, { ...a, items });
    return { id, article_no: articleNo };
  });
  res.json(result);
});

// Edit while pending or returned for correction (inventory officer / super admin).
api.put('/articles/:id', requirePerm('article.edit'), (req, res) => {
  const before = getArticle(req.params.id);
  if (!before) return bad(res, 'Article not found', 404);
  if (!['pending', 'returned'].includes(before.status)) {
    return bad(res, 'Approved records are locked. A Super Administrator can amend them with a reason.', 409);
  }
  const p = parseArticle(req.body || {});
  if (p.error) return bad(res, p.error);
  if (p.a.metal !== before.metal) return bad(res, 'Metal cannot be changed after registration (the Article ID depends on it). Cancel and re-register instead.');
  const oldItems = db.prepare('SELECT line_no, description, weight FROM article_items WHERE article_id = ? ORDER BY line_no').all(before.id);
  tx(() => {
    const now = nowIso();
    db.prepare(
      `UPDATE articles SET ${EDITABLE_FIELDS.map((k) => `${k} = ?`).join(', ')},
              status = 'pending', updated_by = ?, updated_at = ? WHERE id = ?`,
    ).run(...EDITABLE_FIELDS.map((k) => p.a[k]), req.user.id, now, before.id);
    replaceItems(before.id, p.items);
    const changes = diff(before, p.a);
    if (JSON.stringify(oldItems) !== JSON.stringify(p.items)) changes.items = { from: oldItems, to: p.items };
    audit(req, before.status === 'returned' ? 'article.corrected_resubmitted' : 'article.edited', 'article',
      before.id, before.article_no, { changes });
  });
  res.json({ ok: true });
});

api.post('/articles/:id/verify', requirePerm('article.verify'), (req, res) => {
  const a = getArticle(req.params.id);
  if (!a) return bad(res, 'Article not found', 404);
  if (a.status !== 'pending') return bad(res, 'Only entries pending verification can be verified', 409);
  if (a.created_by === req.user.id || a.updated_by === req.user.id) {
    return bad(res, 'You entered or edited this record, so another officer must verify it.', 403);
  }
  const decision = req.body?.decision;
  const remarks = str(req.body?.remarks, 1000);
  const checklist = req.body?.checklist && typeof req.body.checklist === 'object' ? req.body.checklist : null;
  const now = nowIso();
  if (decision === 'approve') {
    const purity = req.body?.purity !== undefined ? str(req.body.purity, 50) : a.purity;
    const purityRemarks = req.body?.purity_remarks !== undefined ? str(req.body.purity_remarks, 500) : a.purity_remarks;
    tx(() => {
      db.prepare(`UPDATE articles SET status = 'approved', verified_by = ?, verified_at = ?, verification_remarks = ?,
                  purity = ?, purity_remarks = ?, return_remarks = NULL WHERE id = ?`)
        .run(req.user.id, now, remarks, purity, purityRemarks, a.id);
      audit(req, 'article.approved', 'article', a.id, a.article_no, { remarks, checklist, purity, purity_remarks: purityRemarks });
    });
  } else if (decision === 'return') {
    if (!remarks) return bad(res, 'Write what needs to be corrected');
    tx(() => {
      db.prepare(`UPDATE articles SET status = 'returned', return_remarks = ? WHERE id = ?`).run(remarks, a.id);
      audit(req, 'article.returned', 'article', a.id, a.article_no, { remarks, checklist });
    });
  } else return bad(res, 'Choose approve or return');
  res.json({ ok: true });
});

// Super admin correction of an approved record. Requires a reason; full before/after kept in the audit trail.
api.post('/articles/:id/amend', requirePerm('article.amend'), (req, res) => {
  const before = getArticle(req.params.id);
  if (!before) return bad(res, 'Article not found', 404);
  if (before.status !== 'approved') return bad(res, 'Only approved records are amended here', 409);
  const reason = str(req.body?.reason, 1000);
  if (!reason) return bad(res, 'A reason for the amendment is required');
  const p = parseArticle(req.body || {});
  if (p.error) return bad(res, p.error);
  if (p.a.metal !== before.metal) return bad(res, 'Metal cannot be changed');
  const oldItems = db.prepare('SELECT line_no, description, weight FROM article_items WHERE article_id = ? ORDER BY line_no').all(before.id);
  const changes = diff(before, p.a);
  if (JSON.stringify(oldItems) !== JSON.stringify(p.items)) changes.items = { from: oldItems, to: p.items };
  if (!Object.keys(changes).length) return bad(res, 'Nothing was changed');
  tx(() => {
    db.prepare(`UPDATE articles SET ${EDITABLE_FIELDS.map((k) => `${k} = ?`).join(', ')}, updated_by = ?, updated_at = ? WHERE id = ?`)
      .run(...EDITABLE_FIELDS.map((k) => p.a[k]), req.user.id, nowIso(), before.id);
    replaceItems(before.id, p.items);
    audit(req, 'article.amended', 'article', before.id, before.article_no, { reason, changes });
  });
  res.json({ ok: true });
});

api.post('/articles/:id/cancel', requirePerm('article.cancel'), (req, res) => {
  const a = getArticle(req.params.id);
  if (!a) return bad(res, 'Article not found', 404);
  if (a.status === 'cancelled') return bad(res, 'Already cancelled', 409);
  const reason = str(req.body?.reason, 1000);
  if (!reason) return bad(res, 'A reason is required');
  tx(() => {
    db.prepare(`UPDATE articles SET status = 'cancelled', cancel_reason = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
      .run(reason, req.user.id, nowIso(), a.id);
    audit(req, 'article.cancelled', 'article', a.id, a.article_no, { reason, previous_status: a.status });
  });
  res.json({ ok: true });
});

// ── photos ────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

function sniffImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png', ext: 'png' };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

api.post('/articles/:id/photos', upload.array('photos', 10), (req, res) => {
  const a = getArticle(req.params.id);
  if (!a) return bad(res, 'Article not found', 404);
  const editable = can(req.user, 'article.edit') && ['pending', 'returned'].includes(a.status);
  if (!editable && !can(req.user, 'article.amend')) return bad(res, 'Photos can only be added while the record is not yet approved', 403);
  const files = req.files || [];
  if (!files.length) return bad(res, 'No photo received');
  const dir = path.join(PHOTO_DIR, a.article_no);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const f of files) {
    const kind = sniffImage(f.buffer);
    if (!kind) continue;
    const sha256 = crypto.createHash('sha256').update(f.buffer).digest('hex');
    const fileName = `${Date.now()}-${sha256.slice(0, 12)}.${kind.ext}`;
    fs.writeFileSync(path.join(dir, fileName), f.buffer, { mode: 0o640 });
    const r = db.prepare(
      'INSERT INTO photos (article_id, file_name, mime, size, sha256, caption, uploaded_by, uploaded_at) VALUES (?,?,?,?,?,?,?,?)',
    ).run(a.id, fileName, kind.mime, f.size, sha256, str(req.body?.caption, 200), req.user.id, nowIso());
    saved.push(Number(r.lastInsertRowid));
    audit(req, 'photo.added', 'photo', Number(r.lastInsertRowid), a.article_no, { sha256, size: f.size });
  }
  if (!saved.length) return bad(res, 'Only JPEG, PNG or WebP photos are accepted');
  res.json({ ids: saved });
});

api.get('/photos/:id', (req, res) => {
  const p = db.prepare('SELECT p.*, a.article_no FROM photos p JOIN articles a ON a.id = p.article_id WHERE p.id = ?')
    .get(Number(req.params.id));
  if (!p) return res.status(404).end();
  const file = path.join(PHOTO_DIR, p.article_no, p.file_name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.setHeader('Content-Type', p.mime);
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  fs.createReadStream(file).pipe(res);
});

// Photos are never erased; they are hidden from the record (file stays on disk, logged).
api.delete('/photos/:id', (req, res) => {
  const p = db.prepare('SELECT p.*, a.article_no, a.status FROM photos p JOIN articles a ON a.id = p.article_id WHERE p.id = ?')
    .get(Number(req.params.id));
  if (!p) return bad(res, 'Not found', 404);
  const editable = can(req.user, 'article.edit') && ['pending', 'returned'].includes(p.status);
  if (!editable && !can(req.user, 'article.amend')) return bad(res, 'Not allowed', 403);
  db.prepare('UPDATE photos SET removed = 1 WHERE id = ?').run(p.id);
  audit(req, 'photo.removed', 'photo', p.id, p.article_no, { sha256: p.sha256 });
  res.json({ ok: true });
});

// ── dashboard ─────────────────────────────────────────────────────────────
api.get('/stats', (req, res) => {
  const sumBy = (where, args = []) => db.prepare(
    `SELECT metal, source, status, COUNT(*) AS entries, SUM(quantity) AS pieces, SUM(gross_weight) AS gross, SUM(COALESCE(net_weight, gross_weight)) AS net
       FROM articles WHERE status != 'cancelled' ${where} GROUP BY metal, source, status`,
  ).all(...args);
  const today = new Date(); // IST day start
  const ist = new Date(today.getTime() + 330 * 60_000);
  const istDayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000).toISOString();
  const monthly = db.prepare(
    `SELECT strftime('%Y-%m', datetime(received_at, '+330 minutes')) AS month, metal,
            COUNT(*) AS entries, SUM(quantity) AS pieces, SUM(gross_weight) AS gross
       FROM articles WHERE status != 'cancelled' AND received_at >= ?
      GROUP BY month, metal ORDER BY month`,
  ).all(new Date(Date.now() - 400 * 86400_000).toISOString());
  const byCategory = db.prepare(
    `SELECT c.metal, c.name, c.name_kn, COUNT(a.id) AS entries, SUM(a.quantity) AS pieces, SUM(a.gross_weight) AS gross
       FROM articles a JOIN categories c ON c.id = a.category_id WHERE a.status = 'approved'
      GROUP BY c.id ORDER BY gross DESC`,
  ).all();
  const recent = db.prepare(`${ARTICLE_SELECT} WHERE a.status != 'cancelled' ORDER BY a.id DESC LIMIT 8`).all()
    .map((a) => redact(req.user, a));
  res.json({
    all: sumBy(''),
    today: sumBy('AND received_at >= ?', [istDayStart]),
    monthly,
    byCategory,
    recent,
    returnedToMe: db.prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'returned' AND created_by = ?").get(req.user.id).n,
  });
});

// ── audit log ─────────────────────────────────────────────────────────────
api.get('/audit', requirePerm('audit.view'), (req, res) => {
  const q = req.query;
  const where = [];
  const args = [];
  if (q.from) { where.push('at >= ?'); args.push(new Date(q.from).toISOString()); }
  if (q.to) { where.push('at < ?'); args.push(new Date(q.to).toISOString()); }
  if (q.article_no) { where.push('article_no = ?'); args.push(String(q.article_no)); }
  if (q.user_id) { where.push('user_id = ?'); args.push(Number(q.user_id)); }
  if (q.action) { where.push('action LIKE ?'); args.push(`${q.action}%`); }
  const rows = db.prepare(`SELECT * FROM audit ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
    .all(...args, Math.min(Number(q.limit) || 2000, 20000))
    .map((h) => ({ ...h, details: h.details ? JSON.parse(h.details) : null }))
    .map((h) => (can(req.user, 'donor.view') ? h : redactHistory(h)));
  res.json(rows);
});

// ── users (super admin) ───────────────────────────────────────────────────
api.get('/users', requirePerm('users.manage'), (_req, res) => {
  res.json(db.prepare(
    `SELECT id, username, name, designation, mobile, role, active, must_change_password, last_login_at, created_at,
            (locked_until IS NOT NULL AND locked_until > strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS locked
       FROM users ORDER BY active DESC, role, name`,
  ).all());
});

api.get('/users/names', (_req, res) => {
  res.json(db.prepare('SELECT id, name, role FROM users ORDER BY name').all());
});

api.post('/users', requirePerm('users.manage'), (req, res) => {
  const username = str(req.body?.username, 40);
  const name = str(req.body?.name, 100);
  const role = req.body?.role;
  const password = String(req.body?.password || '');
  if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return bad(res, 'Username: 3 to 40 letters, numbers, dot, dash or underscore');
  if (!name) return bad(res, 'Name is required');
  if (!ROLES.includes(role)) return bad(res, 'Choose a role');
  const p = passwordProblem(password);
  if (p) return bad(res, p);
  try {
    const r = db.prepare(
      `INSERT INTO users (username, name, designation, mobile, role, password_hash, must_change_password, created_at, created_by)
       VALUES (?,?,?,?,?,?,1,?,?)`,
    ).run(username, name, str(req.body?.designation, 100), str(req.body?.mobile, 20), role, hashPassword(password), nowIso(), req.user.id);
    audit(req, 'user.created', 'user', Number(r.lastInsertRowid), null, { username, name, role });
    res.json({ id: Number(r.lastInsertRowid) });
  } catch {
    bad(res, 'That username is already taken');
  }
});

api.patch('/users/:id', requirePerm('users.manage'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return bad(res, 'Not found', 404);
  const upd = {
    name: req.body?.name !== undefined ? str(req.body.name, 100) : u.name,
    designation: req.body?.designation !== undefined ? str(req.body.designation, 100) : u.designation,
    mobile: req.body?.mobile !== undefined ? str(req.body.mobile, 20) : u.mobile,
    role: req.body?.role ?? u.role,
    active: req.body?.active !== undefined ? (req.body.active ? 1 : 0) : u.active,
  };
  if (!ROLES.includes(upd.role) || !upd.name) return bad(res, 'Invalid values');
  if (u.id === req.user.id && (upd.role !== 'superadmin' || !upd.active)) return bad(res, 'You cannot remove your own Super Administrator access');
  if (u.role === 'superadmin' && (upd.role !== 'superadmin' || !upd.active)) {
    const others = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND active = 1 AND id != ?").get(u.id).n;
    if (!others) return bad(res, 'At least one active Super Administrator is required');
  }
  db.prepare('UPDATE users SET name = ?, designation = ?, mobile = ?, role = ?, active = ? WHERE id = ?')
    .run(upd.name, upd.designation, upd.mobile, upd.role, upd.active, u.id);
  if (!upd.active || upd.role !== u.role) destroyUserSessions(u.id);
  const changes = {};
  for (const k of Object.keys(upd)) if (String(upd[k]) !== String(u[k])) changes[k] = { from: u[k], to: upd[k] };
  audit(req, 'user.updated', 'user', u.id, null, { username: u.username, changes });
  res.json({ ok: true });
});

api.post('/users/:id/reset-password', requirePerm('users.manage'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return bad(res, 'Not found', 404);
  const p = passwordProblem(req.body?.password);
  if (p) return bad(res, p);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL WHERE id = ?')
    .run(hashPassword(req.body.password), u.id);
  destroyUserSessions(u.id);
  audit(req, 'user.password_reset', 'user', u.id, null, { username: u.username });
  res.json({ ok: true });
});

api.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 'LIMIT_FILE_SIZE') return bad(res, 'Photo is too large (max 10 MB)');
  bad(res, 'Something went wrong on the server', 500);
});

// ── static PWA ────────────────────────────────────────────────────────────
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    setHeaders: (res, file) => {
      if (file.endsWith('sw.js') || file.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache');
      else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

bootstrapSuperAdmin();
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`SCKDA Jewel Inventory listening on http://${process.env.HOST || '127.0.0.1'}:${PORT}`);
});
