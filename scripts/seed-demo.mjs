// scripts/seed-demo.mjs — fills a DEMO server with sample officers and articles through the real API.
// NEVER run against the live server. Usage:
//   DEMO_URL=http://127.0.0.1:8080 ADMIN_PASSWORD=... PHOTO_DIR=./demo-photos node scripts/seed-demo.mjs
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.DEMO_URL || 'http://127.0.0.1:8080';
if (!/127\.0\.0\.1|localhost/.test(BASE)) { console.error('Refusing: demo seeding only runs against localhost.'); process.exit(1); }
const PHOTOS = process.env.PHOTO_DIR ? fs.readdirSync(process.env.PHOTO_DIR).filter((f) => f.endsWith('.jpg')).map((f) => path.join(process.env.PHOTO_DIR, f)) : [];

function client() {
  let cookie = '';
  const call = async (method, url, body) => {
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + '/api' + url, {
      method, headers: { 'X-Requested-With': 'sckda-jewel', cookie, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${url}: ${data.error}`);
    return data;
  };
  return { call, login: (u, p) => call('POST', '/auth/login', { username: u, password: p }) };
}

const PW = 'Demo@1234';
const admin = client();
await admin.login('superadmin', process.env.ADMIN_PASSWORD);
try { await admin.call('POST', '/auth/change-password', { current: process.env.ADMIN_PASSWORD, next: PW }); } catch { /* already changed */ }
await admin.login('superadmin', PW).catch(() => {});

const officers = [
  ['ravi', 'Ravi Kumar', 'inventory', 'Inventory Officer'],
  ['lakshmi', 'Lakshmi Devi', 'inventory', 'Inventory Officer'],
  ['manjunath', 'Manjunath S', 'verifier', 'Verification Officer'],
  ['shobha', 'Shobha R', 'accounts', 'Accounts Superintendent'],
  ['authority', 'Authority Official', 'management', 'Commissioner'],
];
for (const [u, n, r, d] of officers) {
  await admin.call('POST', '/users', { username: u, name: n, role: r, designation: d, password: 'Temp1234' }).catch(() => {});
  const c = client();
  await c.login(u, 'Temp1234').then(() => c.call('POST', '/auth/change-password', { current: 'Temp1234', next: PW })).catch(() => {});
}

const cats = await admin.call('GET', '/categories');
const cat = (metal, name) => cats.find((c) => c.metal === metal && c.name === name).id;
const inv = [client(), client()];
await inv[0].login('ravi', PW); await inv[1].login('lakshmi', PW);
const ver = client(); await ver.login('manjunath', PW);

const DONORS = [['Srinivas Rao', '9845012345', 'Kuvempunagar, Mysuru'], ['Geetha Ramesh', '9900123456', 'Jayanagar, Bengaluru'], ['ಶಿವಕುಮಾರ್', '9741234567', 'Mandya'], ['Anitha Prakash', '9886543210', 'Hassan']];
const SAMPLES = [
  ['gold', 'Gold Chains', 'Chain', 'Thin gold chain with small lakshmi pendant hook', 1, [6.2, 14.8]],
  ['gold', 'Gold Rings', 'Ring', 'Plain gold ring, slightly worn', 1, [2.1, 5.4]],
  ['gold', 'Gold Coins', 'Coin', 'Gold coin with Goddess Lakshmi embossing', 1, [1, 10]],
  ['gold', 'Gold Ornaments', 'Thali', 'Mangalasutra thali with two gold beads', 1, [3.5, 9.8]],
  ['gold', 'Gold Bangles', 'Bangle', 'Pair of gold bangles with floral pattern', 2, [18, 32]],
  ['gold', 'Gold Pendants', 'Pendant', 'Om pendant', 1, [1.2, 4.6]],
  ['gold', 'Other Gold Articles', 'Eyes (Netra)', 'Gold eyes offering (pair)', 2, [0.6, 2.4]],
  ['silver', 'Silver Lamps', 'Lamp', 'Silver deepa with five wicks', 1, [120, 480]],
  ['silver', 'Silver Coins', 'Coin', 'Silver coins, assorted', 5, [40, 120]],
  ['silver', 'Silver Ornaments', 'Anklet', 'Pair of silver anklets with bells', 2, [55, 140]],
  ['silver', 'Silver Utensils', 'Plate', 'Silver pooja plate', 1, [180, 650]],
  ['silver', 'Silver Vessels', 'Vessel', 'Silver kalasha', 1, [220, 900]],
  ['silver', 'Silver Articles', 'Crown', 'Small silver crown (kireeta)', 1, [60, 260]],
];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let n = 0;
for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
  const perMonth = monthsAgo === 0 ? 9 : Math.round(rand(3, 7));
  for (let k = 0; k < perMonth; k++) {
    const s = pick(SAMPLES);
    const source = Math.random() < 0.65 ? 'hundi' : 'seva';
    const d = new Date(); d.setUTCMonth(d.getUTCMonth() - monthsAgo); d.setUTCDate(Math.max(1, Math.min(28, monthsAgo === 0 ? d.getUTCDate() - Math.floor(rand(0, 4)) : Math.floor(rand(1, 28))))); d.setUTCHours(Math.floor(rand(4, 11)), Math.floor(rand(0, 59)));
    if (d > new Date()) d.setTime(Date.now() - 3600_000);
    const qty = s[4] + (s[0] === 'silver' && s[2] === 'Coin' ? Math.floor(rand(0, 6)) : 0);
    const gross = Math.round(rand(s[5][0], s[5][1]) * qty * 1000) / 1000;
    const donor = source === 'seva' ? pick(DONORS) : Math.random() < 0.15 ? pick(DONORS) : [null, null, null];
    const items = qty > 1 && qty <= 3 ? Array.from({ length: qty }, (_, i) => ({ description: `${s[2]} ${i + 1}`, weight: Math.round((gross / qty) * 1000) / 1000 })) : [];
    const c = inv[n % 2];
    const body = {
      metal: s[0], category_id: cat(s[0], s[1]), article_type: s[2], description: s[3], quantity: qty, gross_weight: items.length ? items.reduce((a, i) => a + i.weight, 0) : gross,
      net_weight: Math.random() < 0.3 ? Math.round(gross * 0.92 * 1000) / 1000 : null, purity: s[0] === 'gold' ? pick(['22K (916)', '22K (916)', '24K (999)', '']) : pick(['925 Sterling', '999 Fine', '']),
      source, receipt_ref: source === 'hundi' ? `Hundi No. ${Math.floor(rand(1, 12))} · counting ${d.toISOString().slice(0, 10)}` : `SEVA/${d.getUTCFullYear()}/${Math.floor(rand(1000, 9999))}`,
      received_at: d.toISOString(), donor_name: donor[0], donor_mobile: donor[1], donor_address: donor[2], weighed_by: c === inv[0] ? 'Ravi Kumar' : 'Lakshmi Devi', items,
    };
    const r = await c.call('POST', '/articles', body);
    const photo = PHOTOS.filter((p) => path.basename(p).startsWith(s[0]));
    if (photo.length) {
      const fd = new FormData();
      for (const p of [pick(photo), ...(Math.random() < 0.4 ? [pick(photo)] : [])]) fd.append('photos', new Blob([fs.readFileSync(p)], { type: 'image/jpeg' }), path.basename(p));
      await c.call('POST', `/articles/${r.article_no}/photos`, fd);
    }
    const fresh = monthsAgo === 0 && k >= 4;
    if (!fresh) await ver.call('POST', `/articles/${r.id}/verify`, { decision: 'approve', remarks: 'Weighed again, matches.', checklist: { description: true, photo: true, quantity: true, weight: true, source: true, donor: true } });
    else if (k === 8) await ver.call('POST', `/articles/${r.id}/verify`, { decision: 'return', remarks: 'Photo is blurred and net weight missing. Please re-photograph and add net weight.' });
    n++;
  }
}
console.log(`Seeded ${n} demo articles. Logins (password ${PW}): superadmin, ${officers.map((o) => o[0]).join(', ')}`);
