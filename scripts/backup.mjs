// scripts/backup.mjs — consistent snapshot of the database + all photos.
// Usage: DATA_DIR=/var/lib/sckda-jewel node --no-warnings scripts/backup.mjs /var/backups/sckda-jewel
// Safe to run while the app is live (VACUUM INTO makes a consistent copy). Keeps the newest 30 backups.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const OUT = path.resolve(process.argv[2] || './backups');
const KEEP = Number(process.env.KEEP || 30);
const stamp = new Date(Date.now() + 330 * 60_000).toISOString().replace(/[:T]/g, '-').slice(0, 19);
const dir = path.join(OUT, `sckda-jewel-${stamp}`);
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'jewel.db'), { readOnly: true });
db.exec(`VACUUM INTO '${path.join(dir, 'jewel.db').replace(/'/g, "''")}'`);
const counts = {
  articles: db.prepare('SELECT COUNT(*) n FROM articles').get().n,
  photos: db.prepare('SELECT COUNT(*) n FROM photos').get().n,
  audit: db.prepare('SELECT COUNT(*) n FROM audit').get().n,
  users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
};
db.close();
execFileSync('tar', ['-czf', path.join(dir, 'photos.tar.gz'), '-C', DATA_DIR, 'photos']);
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ created: new Date().toISOString(), dataDir: DATA_DIR, counts }, null, 2));
console.log(`Backup written to ${dir}`, counts);

const old = fs.readdirSync(OUT).filter((d) => d.startsWith('sckda-jewel-')).sort().reverse().slice(KEEP);
for (const d of old) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
