// Browser-only DEMO backend (used only when built with VITE_DEMO=1, e.g. for the Netlify preview).
// Mirrors the real server's rules (server/index.mjs) over an in-memory copy of sample data,
// saved in this browser's IndexedDB. Nothing leaves the browser. The real app never loads this file.
import snapshotRaw from './snapshot.json';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface State {
  users: Row[]; categories: Row[]; counters: Row[]; articles: Row[]; items: Row[]; photos: Row[]; audit: Row[];
  session: number | null; seq: Record<string, number>;
}

const PERMISSIONS: Record<string, string[]> = {
  superadmin: ['article.create', 'article.edit', 'article.verify', 'article.amend', 'article.cancel', 'donor.view', 'reports.view', 'audit.view', 'users.manage', 'settings.manage'],
  inventory: ['article.create', 'article.edit', 'donor.view'],
  verifier: ['article.verify', 'donor.view', 'reports.view'],
  accounts: ['donor.view', 'reports.view', 'audit.view'],
  management: ['reports.view', 'audit.view'],
};
export const DEMO_PASSWORD = 'Demo@1234';
const DB_NAME = 'sckda-jewel-demo';
const EDITABLE = ['metal', 'category_id', 'article_type', 'description', 'quantity', 'gross_weight', 'net_weight', 'purity', 'purity_remarks', 'source', 'receipt_ref', 'received_at', 'donor_name', 'donor_mobile', 'donor_address', 'remarks', 'weighed_by'];

// ── persistence (IndexedDB, one record) ─────────────────────────────────────
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function load(): Promise<State | null> {
  try {
    const d = await idb();
    return await new Promise((res) => { const g = d.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); });
  } catch { return null; }
}
async function save(s: State) {
  try { const d = await idb(); d.transaction('kv', 'readwrite').objectStore('kv').put(s, 'state'); } catch { /* private mode: keep in memory */ }
}

/** Fresh copy of the sample data, with all dates shifted so the newest entries look like today. */
function fresh(): State {
  const snap = JSON.parse(JSON.stringify(snapshotRaw)) as Row;
  const shift = Date.now() - Date.parse(snap.takenAt);
  const mv = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(Date.parse(v) + shift).toISOString() : v);
  for (const k of ['users', 'articles', 'photos', 'audit']) for (const r of snap[k]) for (const f of Object.keys(r)) r[f] = mv(r[f]);
  const max = (k: string) => Math.max(0, ...snap[k].map((r: Row) => r.id));
  return { ...snap, session: null, seq: { articles: max('articles'), items: max('items'), photos: max('photos'), audit: max('audit'), users: max('users'), categories: max('categories') } } as unknown as State;
}

let S: State;
const ready = (async () => { S = (await load()) || fresh(); })();
export async function resetDemo() { S = fresh(); await save(S); }

// ── helpers ────────────────────────────────────────────────────────────────
class HttpError extends Error { constructor(public status: number, msg: string, public code?: string) { super(msg); } }
const fail = (status: number, msg: string, code?: string): never => { throw new HttpError(status, msg, code); };
const now = () => new Date().toISOString();
const next = (k: string) => (S.seq[k] = (S.seq[k] || 0) + 1);
const me = () => S.users.find((u) => u.id === S.session && u.active);
const can = (u: Row | undefined, p: string) => !!u && (PERMISSIONS[u.role] || []).includes(p);
const str = (v: unknown, max = 500) => (v == null ? null : String(v).trim().slice(0, max) || null);
const num = (v: unknown) => (v === '' || v == null ? null : Number(v));
function log(action: string, entity: string, entityId: number | null, articleNo: string | null, details: unknown) {
  const u = me();
  S.audit.push({ id: next('audit'), at: now(), user_id: u?.id ?? null, user_name: u?.name ?? null, user_role: u?.role ?? null, action, entity, entity_id: entityId, article_no: articleNo, details: details ?? null, ip: 'demo' });
}

function view(a: Row): Row {
  const c = S.categories.find((x) => x.id === a.category_id) || {};
  const name = (id: number | null) => S.users.find((u) => u.id === id)?.name ?? null;
  const ph = S.photos.filter((p) => p.article_id === a.id && !p.removed);
  const v = { ...a, category_name: c.name, category_name_kn: c.name_kn, created_by_name: name(a.created_by), updated_by_name: name(a.updated_by), verified_by_name: name(a.verified_by), photo_count: ph.length, cover_photo_id: ph[0]?.id ?? null };
  if (can(me(), 'donor.view')) return v;
  const has = !!(a.donor_name || a.donor_mobile || a.donor_address);
  return { ...v, donor_name: has ? '•••' : null, donor_mobile: null, donor_address: null, donor_hidden: true };
}
function scrub(h: Row): Row {
  if (can(me(), 'donor.view') || !h.details) return h;
  const d = JSON.parse(JSON.stringify(h.details));
  const walk = (o: Row) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k.startsWith('donor_')) o[k] = '•••'; else walk(o[k]); } };
  walk(d);
  return { ...h, details: d };
}
const byIdOrNo = (x: string) => S.articles.find((a) => (/^[A-Z]{2}-\d{4}-\d+$/.test(x) ? a.article_no === x : a.id === Number(x))) || fail(404, 'Article not found');

function parse(b: Row) {
  const a: Row = {
    metal: b.metal, category_id: Number(b.category_id), article_type: str(b.article_type, 100), description: str(b.description, 1000),
    quantity: Number(b.quantity), gross_weight: num(b.gross_weight), net_weight: num(b.net_weight), purity: str(b.purity, 50),
    purity_remarks: str(b.purity_remarks, 500), source: b.source, receipt_ref: str(b.receipt_ref, 100), received_at: str(b.received_at, 40),
    donor_name: str(b.donor_name, 150), donor_mobile: str(b.donor_mobile, 20), donor_address: str(b.donor_address, 500), remarks: str(b.remarks, 1000), weighed_by: str(b.weighed_by, 150),
  };
  const items = (Array.isArray(b.items) ? b.items : []).filter((i: Row) => Number(i?.weight) > 0).map((i: Row, k: number) => ({ line_no: k + 1, description: str(i.description, 200), weight: Number(i.weight) }));
  if (!['gold', 'silver'].includes(a.metal)) fail(400, 'Choose Gold or Silver');
  if (!['hundi', 'seva'].includes(a.source)) fail(400, 'Choose the source: Hundi or Seva');
  const cat = S.categories.find((c) => c.id === a.category_id);
  if (!cat || cat.metal !== a.metal) fail(400, 'Choose a category for this metal');
  if (!a.description) fail(400, 'Description is required');
  if (!Number.isInteger(a.quantity) || a.quantity < 1) fail(400, 'Quantity must be a whole number of at least 1');
  if (!(a.gross_weight > 0)) fail(400, 'Gross weight (grams) is required');
  if (a.net_weight != null && (!(a.net_weight > 0) || a.net_weight > a.gross_weight)) fail(400, 'Net weight must be more than 0 and not more than gross weight');
  if (!a.received_at || Number.isNaN(Date.parse(a.received_at))) fail(400, 'Date and time of receipt is required');
  a.received_at = new Date(a.received_at).toISOString();
  if (Date.parse(a.received_at) > Date.now() + 300_000) fail(400, 'Date of receipt cannot be in the future');
  a.gross_weight = Math.round(a.gross_weight * 1000) / 1000;
  if (a.net_weight != null) a.net_weight = Math.round(a.net_weight * 1000) / 1000;
  return { a, items };
}
const itemsOf = (id: number) => S.items.filter((i) => i.article_id === id).sort((x, y) => x.line_no - y.line_no).map(({ line_no, description, weight }) => ({ line_no, description, weight }));
function setItems(id: number, items: Row[]) { S.items = S.items.filter((i) => i.article_id !== id).concat(items.map((i) => ({ ...i, id: next('items'), article_id: id }))); }
function diff(before: Row, after: Row) {
  const c: Row = {};
  for (const k of EDITABLE) if (String(before[k] ?? null) !== String(after[k] ?? null)) c[k] = { from: before[k] ?? null, to: after[k] ?? null };
  return c;
}
const fileToDataUrl = (f: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
export const demoPhotoSrc = (id: number) => S?.photos.find((p) => p.id === id)?.src || '';

// ── routes ─────────────────────────────────────────────────────────────────
async function route(method: string, url: string, body: any): Promise<unknown> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const u = new URL(url, 'http://demo');
  const p = u.pathname;
  const q = Object.fromEntries(u.searchParams);
  const m = (re: RegExp) => p.match(re);
  const user = me();

  if (method === 'POST' && p === '/auth/login') {
    const x = S.users.find((y) => y.username.toLowerCase() === String(body?.username || '').toLowerCase().trim());
    if (!x || !x.active || body?.password !== DEMO_PASSWORD) fail(401, `Wrong username or password (demo password is ${DEMO_PASSWORD})`);
    S.session = x!.id; x!.last_login_at = now(); log('auth.login', 'user', x!.id, null, null);
    return { ok: true };
  }
  if (method === 'POST' && p === '/auth/logout') { if (user) log('auth.logout', 'user', user.id, null, null); S.session = null; return { ok: true }; }
  if (method === 'GET' && p === '/auth/me') {
    if (!user) fail(401, 'Not logged in');
    return { user: { id: user!.id, username: user!.username, name: user!.name, designation: user!.designation, role: user!.role, mustChangePassword: false }, permissions: PERMISSIONS[user!.role] };
  }
  if (method === 'POST' && p === '/auth/change-password') fail(400, 'Passwords cannot be changed in the demo');
  if (!user) fail(401, 'Please log in');
  const need = (perm: string) => { if (!can(user, perm)) fail(403, 'You do not have permission for this'); };

  if (p === '/categories') {
    if (method === 'GET') return [...S.categories].sort((a, b) => (a.metal + String(a.sort).padStart(5, '0')).localeCompare(b.metal + String(b.sort).padStart(5, '0')));
    need('settings.manage');
    const name = str(body?.name, 80);
    if (!['gold', 'silver'].includes(body?.metal) || !name) fail(400, 'Metal and name are required');
    if (S.categories.some((c) => c.metal === body.metal && c.name.toLowerCase() === name!.toLowerCase())) fail(400, 'A category with this name already exists');
    const c = { id: next('categories'), metal: body.metal, name, name_kn: str(body.name_kn, 80), active: 1, sort: 10 + Math.max(0, ...S.categories.filter((x) => x.metal === body.metal).map((x) => x.sort)) };
    S.categories.push(c); log('category.create', 'category', c.id, null, { metal: c.metal, name, name_kn: c.name_kn });
    return { id: c.id };
  }
  let r = m(/^\/categories\/(\d+)$/);
  if (r && method === 'PATCH') {
    need('settings.manage');
    const c = S.categories.find((x) => x.id === Number(r![1])) || fail(404, 'Not found');
    const before = { ...c };
    if (body.name !== undefined) c.name = str(body.name, 80) || c.name;
    if (body.name_kn !== undefined) c.name_kn = str(body.name_kn, 80);
    if (body.active !== undefined) c.active = body.active ? 1 : 0;
    log('category.update', 'category', c.id, null, { before, after: { name: c.name, name_kn: c.name_kn, active: c.active } });
    return { ok: true };
  }

  if (p === '/articles' && method === 'GET') {
    let rows = S.articles.slice();
    if (q.metal) rows = rows.filter((a) => a.metal === q.metal);
    if (q.source) rows = rows.filter((a) => a.source === q.source);
    if (q.status) { const st = q.status.split(','); rows = rows.filter((a) => st.includes(a.status)); } else if (q.includeCancelled !== '1') rows = rows.filter((a) => a.status !== 'cancelled');
    if (q.category_id) rows = rows.filter((a) => a.category_id === Number(q.category_id));
    if (q.from) rows = rows.filter((a) => a.received_at >= new Date(q.from).toISOString());
    if (q.to) rows = rows.filter((a) => a.received_at < new Date(q.to).toISOString());
    if (q.minWeight) rows = rows.filter((a) => a.gross_weight >= Number(q.minWeight));
    if (q.maxWeight) rows = rows.filter((a) => a.gross_weight <= Number(q.maxWeight));
    if (q.createdByMe === '1') rows = rows.filter((a) => a.created_by === user!.id);
    if (q.search) {
      const s = q.search.toLowerCase().trim();
      const fields = ['article_no', 'description', 'receipt_ref', 'article_type', ...(can(user, 'donor.view') ? ['donor_name', 'donor_mobile'] : [])];
      rows = rows.filter((a) => fields.some((f) => String(a[f] ?? '').toLowerCase().includes(s)));
    }
    rows.sort((a, b) => (b.received_at.localeCompare(a.received_at)) || b.id - a.id);
    return rows.slice(0, Number(q.limit) || 5000).map(view);
  }
  if (p === '/articles' && method === 'POST') {
    need('article.create');
    const { a, items } = parse(body);
    const key = `${a.metal === 'gold' ? 'AU' : 'AG'}-${a.received_at.slice(0, 4)}`;
    let c = S.counters.find((x) => x.key === key);
    if (!c) { c = { key, value: 0 }; S.counters.push(c); }
    c.value += 1;
    const article_no = `${key}-${String(c.value).padStart(5, '0')}`;
    const id = next('articles');
    S.articles.push({ id, article_no, ...a, status: 'pending', return_remarks: null, verified_by: null, verified_at: null, verification_remarks: null, cancel_reason: null, created_by: user!.id, created_at: now(), updated_by: null, updated_at: null });
    setItems(id, items);
    log('article.registered', 'article', id, article_no, { ...a, items });
    return { id, article_no };
  }
  r = m(/^\/articles\/([^/]+)$/);
  if (r && method === 'GET') {
    const a = byIdOrNo(decodeURIComponent(r[1]));
    const photos = S.photos.filter((x) => x.article_id === a.id && !x.removed).map((x) => ({ id: x.id, caption: x.caption, size: x.size, uploaded_at: x.uploaded_at, uploaded_by_name: S.users.find((y) => y.id === x.uploaded_by)?.name }));
    return { article: view(a), items: S.items.filter((i) => i.article_id === a.id).sort((x, y) => x.line_no - y.line_no), photos, history: S.audit.filter((h) => h.article_no === a.article_no).map(scrub) };
  }
  if (r && method === 'PUT') {
    need('article.edit');
    const before = byIdOrNo(r[1]);
    if (!['pending', 'returned'].includes(before.status)) fail(409, 'Approved records are locked. A Super Administrator can amend them with a reason.');
    const { a, items } = parse(body);
    if (a.metal !== before.metal) fail(400, 'Metal cannot be changed after registration.');
    const changes: Row = diff(before, a);
    const old = itemsOf(before.id);
    if (JSON.stringify(old) !== JSON.stringify(items)) changes.items = { from: old, to: items };
    const wasReturned = before.status === 'returned';
    Object.assign(before, a, { status: 'pending', updated_by: user!.id, updated_at: now() });
    setItems(before.id, items);
    log(wasReturned ? 'article.corrected_resubmitted' : 'article.edited', 'article', before.id, before.article_no, { changes });
    return { ok: true };
  }
  r = m(/^\/articles\/(\d+)\/verify$/);
  if (r) {
    need('article.verify');
    const a = byIdOrNo(r[1]);
    if (a.status !== 'pending') fail(409, 'Only entries pending verification can be verified');
    if (a.created_by === user!.id || a.updated_by === user!.id) fail(403, 'You entered or edited this record, so another officer must verify it.');
    const remarks = str(body?.remarks, 1000);
    if (body?.decision === 'approve') {
      const purity = body.purity !== undefined ? str(body.purity, 50) : a.purity;
      const pr = body.purity_remarks !== undefined ? str(body.purity_remarks, 500) : a.purity_remarks;
      Object.assign(a, { status: 'approved', verified_by: user!.id, verified_at: now(), verification_remarks: remarks, purity, purity_remarks: pr, return_remarks: null });
      log('article.approved', 'article', a.id, a.article_no, { remarks, checklist: body.checklist, purity, purity_remarks: pr });
    } else if (body?.decision === 'return') {
      if (!remarks) fail(400, 'Write what needs to be corrected');
      Object.assign(a, { status: 'returned', return_remarks: remarks });
      log('article.returned', 'article', a.id, a.article_no, { remarks, checklist: body.checklist });
    } else fail(400, 'Choose approve or return');
    return { ok: true };
  }
  r = m(/^\/articles\/(\d+)\/amend$/);
  if (r) {
    need('article.amend');
    const before = byIdOrNo(r[1]);
    if (before.status !== 'approved') fail(409, 'Only approved records are amended here');
    const reason = str(body?.reason, 1000) || fail(400, 'A reason for the amendment is required');
    const { a, items } = parse(body);
    const changes: Row = diff(before, a);
    const old = itemsOf(before.id);
    if (JSON.stringify(old) !== JSON.stringify(items)) changes.items = { from: old, to: items };
    if (!Object.keys(changes).length) fail(400, 'Nothing was changed');
    Object.assign(before, a, { updated_by: user!.id, updated_at: now() });
    setItems(before.id, items);
    log('article.amended', 'article', before.id, before.article_no, { reason, changes });
    return { ok: true };
  }
  r = m(/^\/articles\/(\d+)\/cancel$/);
  if (r) {
    need('article.cancel');
    const a = byIdOrNo(r[1]);
    if (a.status === 'cancelled') fail(409, 'Already cancelled');
    const reason = str(body?.reason, 1000) || fail(400, 'A reason is required');
    const prev = a.status;
    Object.assign(a, { status: 'cancelled', cancel_reason: reason, updated_by: user!.id, updated_at: now() });
    log('article.cancelled', 'article', a.id, a.article_no, { reason, previous_status: prev });
    return { ok: true };
  }
  r = m(/^\/articles\/([^/]+)\/photos$/);
  if (r && method === 'POST') {
    const a = byIdOrNo(decodeURIComponent(r[1]));
    const editable = can(user, 'article.edit') && ['pending', 'returned'].includes(a.status);
    if (!editable && !can(user, 'article.amend')) fail(403, 'Photos can only be added while the record is not yet approved');
    const files = (body as FormData).getAll('photos') as File[];
    const ids: number[] = [];
    for (const f of files) {
      const id = next('photos');
      S.photos.push({ id, article_id: a.id, src: await fileToDataUrl(f), mime: f.type, size: f.size, sha256: String(id), caption: null, removed: 0, uploaded_by: user!.id, uploaded_at: now() });
      ids.push(id); log('photo.added', 'photo', id, a.article_no, { size: f.size });
    }
    return { ids };
  }
  r = m(/^\/photos\/(\d+)$/);
  if (r && method === 'DELETE') {
    const ph = S.photos.find((x) => x.id === Number(r![1])) || fail(404, 'Not found');
    const a = S.articles.find((x) => x.id === ph.article_id)!;
    const editable = can(user, 'article.edit') && ['pending', 'returned'].includes(a.status);
    if (!editable && !can(user, 'article.amend')) fail(403, 'Not allowed');
    ph.removed = 1; log('photo.removed', 'photo', ph.id, a.article_no, null);
    return { ok: true };
  }

  if (p === '/stats') {
    const live = S.articles.filter((a) => a.status !== 'cancelled');
    const group = (rows: Row[]) => {
      const g = new Map<string, Row>();
      for (const a of rows) {
        const k = `${a.metal}|${a.source}|${a.status}`;
        const x = g.get(k) || { metal: a.metal, source: a.source, status: a.status, entries: 0, pieces: 0, gross: 0, net: 0 };
        x.entries += 1; x.pieces += a.quantity; x.gross += a.gross_weight; x.net += a.net_weight ?? a.gross_weight; g.set(k, x);
      }
      return [...g.values()];
    };
    const ist = new Date(Date.now() + 330 * 60_000);
    const dayStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 330 * 60_000).toISOString();
    const since = new Date(Date.now() - 400 * 86400_000).toISOString();
    const mon = new Map<string, Row>();
    for (const a of live.filter((x) => x.received_at >= since)) {
      const month = new Date(Date.parse(a.received_at) + 330 * 60_000).toISOString().slice(0, 7);
      const k = `${month}|${a.metal}`;
      const x = mon.get(k) || { month, metal: a.metal, entries: 0, pieces: 0, gross: 0 };
      x.entries += 1; x.pieces += a.quantity; x.gross += a.gross_weight; mon.set(k, x);
    }
    const cat = new Map<number, Row>();
    for (const a of live.filter((x) => x.status === 'approved')) {
      const c = S.categories.find((y) => y.id === a.category_id)!;
      const x = cat.get(c.id) || { metal: c.metal, name: c.name, name_kn: c.name_kn, entries: 0, pieces: 0, gross: 0 };
      x.entries += 1; x.pieces += a.quantity; x.gross += a.gross_weight; cat.set(c.id, x);
    }
    return {
      all: group(live), today: group(live.filter((a) => a.received_at >= dayStart)),
      monthly: [...mon.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byCategory: [...cat.values()].sort((a, b) => b.gross - a.gross),
      recent: live.sort((a, b) => b.id - a.id).slice(0, 8).map(view),
      returnedToMe: S.articles.filter((a) => a.status === 'returned' && a.created_by === user!.id).length,
    };
  }

  if (p === '/audit') {
    need('audit.view');
    let rows = S.audit.slice();
    if (q.from) rows = rows.filter((h) => h.at >= new Date(q.from).toISOString());
    if (q.to) rows = rows.filter((h) => h.at < new Date(q.to).toISOString());
    if (q.article_no) rows = rows.filter((h) => h.article_no === q.article_no);
    if (q.user_id) rows = rows.filter((h) => h.user_id === Number(q.user_id));
    if (q.action) rows = rows.filter((h) => h.action.startsWith(q.action));
    return rows.sort((a, b) => b.id - a.id).slice(0, Number(q.limit) || 2000).map(scrub);
  }

  if (p === '/users/names') return S.users.map((x) => ({ id: x.id, name: x.name, role: x.role }));
  if (p === '/users' && method === 'GET') {
    need('users.manage');
    return S.users.map((x) => ({ ...x, must_change_password: 0, locked: 0 } as Row)).sort((a, b) => b.active - a.active || a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  }
  if (p === '/users' && method === 'POST') {
    need('users.manage');
    const username = str(body?.username, 40);
    if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) fail(400, 'Username: 3 to 40 letters, numbers, dot, dash or underscore');
    if (!str(body?.name)) fail(400, 'Name is required');
    if (!PERMISSIONS[body?.role]) fail(400, 'Choose a role');
    if (S.users.some((x) => x.username.toLowerCase() === username!.toLowerCase())) fail(400, 'That username is already taken');
    const x = { id: next('users'), username, name: str(body.name, 100), designation: str(body.designation, 100), mobile: str(body.mobile, 20), role: body.role, active: 1, last_login_at: null, created_at: now() };
    S.users.push(x); log('user.created', 'user', x.id, null, { username, name: x.name, role: x.role });
    return { id: x.id };
  }
  r = m(/^\/users\/(\d+)$/);
  if (r && method === 'PATCH') {
    need('users.manage');
    const x = S.users.find((y) => y.id === Number(r![1])) || fail(404, 'Not found');
    const upd = { name: body.name !== undefined ? str(body.name, 100) : x.name, designation: body.designation !== undefined ? str(body.designation, 100) : x.designation, mobile: body.mobile !== undefined ? str(body.mobile, 20) : x.mobile, role: body.role ?? x.role, active: body.active !== undefined ? (body.active ? 1 : 0) : x.active };
    if (x.id === user!.id && (upd.role !== 'superadmin' || !upd.active)) fail(400, 'You cannot remove your own Super Administrator access');
    const changes: Row = {};
    for (const k of Object.keys(upd)) if (String((upd as Row)[k]) !== String(x[k])) changes[k] = { from: x[k], to: (upd as Row)[k] };
    Object.assign(x, upd); log('user.updated', 'user', x.id, null, { username: x.username, changes });
    return { ok: true };
  }
  r = m(/^\/users\/(\d+)\/reset-password$/);
  if (r) { need('users.manage'); fail(400, `In the demo every account uses the password ${DEMO_PASSWORD}`); }

  fail(404, 'Not found');
}

/** Same contract as fetch('/api…'): resolves with data or throws {status, message, code}. */
export async function demoRequest(method: string, url: string, body?: unknown) {
  await ready;
  try {
    const data = await route(method, url, body);
    if (method !== 'GET') await save(S);
    else if (url.startsWith('/auth/me')) await save(S);
    return { ok: true as const, status: 200, data };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false as const, status: e.status, data: { error: e.message, code: e.code } };
    console.error(e);
    return { ok: false as const, status: 500, data: { error: 'Something went wrong in the demo' } };
  }
}
export const demoReady = () => ready;
