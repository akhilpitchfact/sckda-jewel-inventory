# SCKDA Gold & Silver Inventory: Handover for deployment (Nisar)

Plain-language notes for whoever deploys and looks after the app. The technical details are in `README.md`.

## 1. What this is

- One Node.js app. It serves both the website and the API (`server/index.mjs`) on port **8080**.
- **Database:** a single SQLite file, `jewel.db`. There is no separate database server, no MySQL or Postgres to install, and no DB username or password. The file lives in the folder set by `DATA_DIR`.
- **Photos:** stored as normal image files in `DATA_DIR/photos/<Article ID>/`.
- So **everything the temple owns is in one folder** (`DATA_DIR`, e.g. `/var/lib/sckda-jewel`). Back that folder up and you have backed up everything.
- Needs **Node.js 22.5 or newer** (it uses Node's built-in SQLite). Nothing else needs to be compiled.

## 2. Try it locally (demo data)

```bash
cd jewel-inventory
npm install
npm run build

# terminal 1: start the server with an empty demo database
DATA_DIR=./demo-data ADMIN_PASSWORD=Start1234 COOKIE_SECURE=false npm start

# terminal 2: fill it with sample officers and ~70 sample articles
ADMIN_PASSWORD=Start1234 PHOTO_DIR=./demo-photos node scripts/seed-demo.mjs
```
Open **http://localhost:8080**.

### Demo logins (demo database only)

All demo accounts use the password **`Demo@1234`**.

| Username | Role | What they can do |
|---|---|---|
| `superadmin` | Super Administrator | Everything: users, categories, amend or cancel approved records |
| `ravi`, `lakshmi` | Inventory Officer | Register articles, photos and weights |
| `manjunath` | Verification Officer | Approve, or return for correction |
| `shobha` | Accounts Officer | Reports and audit trail, can see donor details |
| `authority` | Management | Dashboard and reports, donor details hidden |

To start over, stop the server and delete the `demo-data` folder.

## 3. Production logins

- **The first time** the server starts with an empty `DATA_DIR`, it creates **one** account: username `superadmin` (or `ADMIN_USERNAME`).
  - If `ADMIN_PASSWORD` is set, that becomes the temporary password. If it isn't, a random one is printed **once** in the server log (`journalctl -u sckda-jewel -n 30`).
  - At first login the app forces a password change.
- The Super Administrator then creates every officer from **Users → Add user**. Each officer gets a temporary password and must change it at first login.
- If someone forgets their password: Super Admin → **Users → Reset password**.
- If the Super Admin is locked out: wait 15 minutes (the lockout after 5 wrong tries is temporary), or ask the developer for a one-off reset.
- **Do not put real passwords in this file, in git, or in WhatsApp.** Hand them over in person or over the phone.

## 4. Deploying on the subdomain

1. Create a DNS **A record** for the subdomain (e.g. `jewels.srichamundeshwaridevi.in`) pointing at the server's IP. The main website is not touched.
2. On the server (Ubuntu or Debian with Node 22, nginx and certbot), follow **"Deploy on a subdomain"** in `README.md`: a systemd service, an nginx reverse proxy (`deploy/nginx-jewels.conf`) and `certbot` for HTTPS.
   Or use Docker with `deploy/Dockerfile`.
3. The service runs as user `sckda-jewel` with `DATA_DIR=/var/lib/sckda-jewel`. Port 8080 only listens on localhost; nginx serves it over HTTPS.
4. HTTPS is required. Login cookies are marked `Secure`, so logging in over plain http only works when `COOKIE_SECURE=false` is set (local testing only).

## 5. Backups (important)

- `scripts/backup.mjs` makes a consistent copy of the database plus a `photos.tar.gz`. It is safe to run while the app is in use, and it keeps the newest 30 copies.
- Install the nightly cron line from `README.md`, and **copy `/var/backups/sckda-jewel` off the server** regularly (Google Drive, another machine, or similar). A backup that only exists on the same server does not survive a dead disk.
- **Restore:** stop the service → copy `jewel.db` into `DATA_DIR` → extract `photos.tar.gz` into `DATA_DIR` → start the service.
- **Never delete `DATA_DIR`**, and never run the demo seeding script against the live server (it refuses anything that isn't localhost anyway).

## 6. Updating the app later

```bash
# take a backup first
cd /opt/sckda-jewel && <copy new code over, keeping DATA_DIR untouched>
npm ci && npm run build && npm prune --omit=dev
sudo systemctl restart sckda-jewel
```
The database tables are created or extended automatically at start. No migrations need to be run by hand.

## 7. Useful commands

| Task | Command |
|---|---|
| Status / restart | `sudo systemctl status sckda-jewel` / `sudo systemctl restart sckda-jewel` |
| Logs | `sudo journalctl -u sckda-jewel -f` |
| Manual backup | `cd /opt/sckda-jewel && sudo -u sckda-jewel DATA_DIR=/var/lib/sckda-jewel node --no-warnings scripts/backup.mjs /var/backups/sckda-jewel` |
| Where the data is | `/var/lib/sckda-jewel/jewel.db` and `/var/lib/sckda-jewel/photos/` |

## 8. Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `8080`, `127.0.0.1` | where the app listens (keep it on localhost behind nginx) |
| `DATA_DIR` | `./data` | database + photos folder |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `superadmin`, random | used only on the very first start |
| `COOKIE_SECURE` | `true` | set `false` only for local http testing |
| `TRUST_PROXY` | `loopback` | use `1` in Docker behind nginx |
| `SESSION_IDLE_MINUTES`, `SESSION_MAX_HOURS` | `60`, `12` | automatic logout |
