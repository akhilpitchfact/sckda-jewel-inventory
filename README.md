# SCKDA Gold & Silver Articles Inventory

Gold & Silver Articles Accounting and Inventory Management application for
**Sri Chamundeshwari Kshetra Development Authority, Mysuru**, built by Pitchfact Digital Technologies
from the proposal *Design, Development & Implementation of Gold and Silver Articles Accounting & Inventory Management Application*.

Bilingual (English / ಕನ್ನಡ), same Noto Sans Kannada font files as the Hundi Counting app, installable as a PWA on phones and tablets.

## What it does (mapped to the proposal)

| Proposal | Where |
|---|---|
| 3.1 Login & roles (Super Admin, Inventory, Verification, Accounts, Management) | `server/auth.mjs` (`PERMISSIONS`), Users screen |
| 3.2 Article receipt & registration (auto Article ID, Hundi/Seva, donor optional) | Register Article screen, `POST /api/articles` |
| 3.3 Gold & silver categories, configurable | Categories screen (defaults seeded from the proposal) |
| 3.4 Photo capture (rear camera) and upload, multiple per article | Register / Edit screen, `POST /api/articles/:id/photos` |
| 3.5 Gross/net weight to the milligram, individual piece weights, purity, weighed-by | Register screen section 4 |
| 3.6 Two-stage verification with checklist, approve or return with remarks | Article page (verifier), Verification queue |
| 3.7 / 4 Central inventory + management dashboard with charts | Dashboard, Inventory (filters: date, source, category, weight, status) |
| 3.8 Twelve reports, PDF and Excel | Reports screen, `src/reports/definitions.ts` |
| 5 Traceability & audit | Append-only `audit` table (DB triggers block edits/deletes), history on every article, Audit Trail screen |
| 7 Security | scrypt passwords, forced first-login change, lockout after 5 wrong tries, HttpOnly SameSite cookies, CSRF header, donor details hidden from Management, approved records locked |

Article IDs: `AU-2026-00001` (gold) and `AG-2026-00001` (silver), numbered per metal per year.

Rules worth knowing:
- The officer who entered or edited a record cannot verify it.
- Approved records can only be changed by a Super Administrator, with a written reason; old and new values go to the audit trail.
- Nothing is ever deleted. Records are *cancelled* with a reason; photos are hidden from the record but kept on disk.

## Stack

- Front end: React 18 + Vite + Tailwind, PWA (`vite-plugin-pwa`). PDF via jsPDF, Excel via ExcelJS (loaded on demand).
- Server: Node 22 + Express, SQLite through Node's built-in `node:sqlite` (no native modules to compile).
- Data: one folder (`DATA_DIR`) holding `jewel.db` and `photos/<Article ID>/…`.

## Run locally

```bash
npm install
npm run dev            # API on :8080 + Vite on :5173 (proxy). Data goes to ./data
```
First start prints the Super Administrator's temporary password in the console (or set `ADMIN_PASSWORD`).

Demo data (local only, never on the live server):
```bash
DATA_DIR=/tmp/demo ADMIN_PASSWORD=Start1234 COOKIE_SECURE=false npm start   # in one terminal
ADMIN_PASSWORD=Start1234 node scripts/seed-demo.mjs                        # in another
```

## Deploy on a subdomain of srichamundeshwaridevi.in

Needs: a Linux server (any small VPS: 1 vCPU / 1 GB RAM is plenty) with Node 22.5+, nginx and certbot,
and a DNS record for the subdomain pointing at it (e.g. `jewels.srichamundeshwaridevi.in`, created by Nisar).

```bash
# 1. user + folders
sudo useradd --system --home /opt/sckda-jewel sckda-jewel
sudo mkdir -p /opt/sckda-jewel /var/lib/sckda-jewel /var/backups/sckda-jewel
sudo chown sckda-jewel: /var/lib/sckda-jewel /var/backups/sckda-jewel

# 2. code
sudo cp -r . /opt/sckda-jewel && cd /opt/sckda-jewel
sudo npm ci && sudo npm run build && sudo npm prune --omit=dev

# 3. service (edit the file first if paths differ)
sudo cp deploy/sckda-jewel.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sckda-jewel
sudo journalctl -u sckda-jewel -n 20      # shows the first-start Super Admin password

# 4. nginx + HTTPS
sudo cp deploy/nginx-jewels.conf /etc/nginx/sites-available/jewels.srichamundeshwaridevi.in
sudo ln -s /etc/nginx/sites-available/jewels.srichamundeshwaridevi.in /etc/nginx/sites-enabled/
sudo certbot --nginx -d jewels.srichamundeshwaridevi.in
sudo nginx -t && sudo systemctl reload nginx

# 5. nightly backups (02:30 IST) — copy /var/backups/sckda-jewel off the server regularly
echo '30 21 * * * sckda-jewel cd /opt/sckda-jewel && DATA_DIR=/var/lib/sckda-jewel /usr/bin/node --no-warnings scripts/backup.mjs /var/backups/sckda-jewel' | sudo tee /etc/cron.d/sckda-jewel-backup
```

Docker alternative: `deploy/Dockerfile` (instructions at the top of the file).

If the main site is on shared hosting (cPanel) without Node, the subdomain can still point at a separate small VPS: only a DNS A record for the subdomain changes; the main website is untouched.

Updating: copy the new code, `npm ci && npm run build`, `sudo systemctl restart sckda-jewel`. Take a backup first. The database schema is created/extended automatically at start.

Restore: stop the service, copy `jewel.db` from a backup folder into `DATA_DIR`, extract `photos.tar.gz` into `DATA_DIR`, start the service.

## Environment variables (server)

| Variable | Default | |
|---|---|---|
| `PORT` / `HOST` | `8080` / `127.0.0.1` | keep on localhost behind nginx |
| `DATA_DIR` | `./data` | database + photos |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `superadmin` / random | only used on the very first start |
| `COOKIE_SECURE` | `true` | set `false` only for local http testing |
| `TRUST_PROXY` | `loopback` | `1` when behind one proxy in Docker |
| `SESSION_IDLE_MINUTES` / `SESSION_MAX_HOURS` | `60` / `12` | auto logout |

## Not in this first version

- Electronic weighing-scale integration (proposal lists it as a later enhancement; weights are typed in).
- Offline data entry: the app shell installs and opens offline, but saving needs a connection so that every record gets its ID and audit entry from the server.
- PDF downloads use the Noto Sans Kannada font, but jsPDF does not shape Kannada conjuncts perfectly; for documents with lots of Kannada text use the **Print** button (browser "Save as PDF").
