# VPS Deployment Guide (NGINX)

This guide deploys the KONI Batam app on a single Ubuntu/Debian VPS that
already has **NGINX installed**. The Express API runs as a Node process
(managed by PM2) on `127.0.0.1:4100`; the React SPA is built to static files
served by NGINX.

The SPA and the API are on **separate hostnames** — the SPA calls
`https://api.simo-konibatam.com/api/v1`, not a same-origin `/api/v1` path:

```
Browser ──► NGINX (443/80)
              ├─ simo-konibatam.com      → static files from /var/www/konibatam
              │    └─ /uploads/*         → proxy_pass http://127.0.0.1:4100
              ├─ api.simo-konibatam.com  → proxy_pass http://127.0.0.1:4100 (all paths)
              └─ <bare IP, default>      → SPA + /api, /uploads, /socket.io, /health
```

Two site files back this, both already on the server:

| File | Purpose |
| --- | --- |
| `/etc/nginx/sites-available/konibatam` | IP-based fallback on port 80 (`default_server`); serves the SPA and proxies `/api`, `/uploads`, `/socket.io`, `/health` |
| `/etc/nginx/sites-available/simo-konibatam` | Domain vhosts with TLS: the SPA on `simo-konibatam.com`, the API on `api.simo-konibatam.com` |

**Deploys are automated.** Pushing to `main` triggers
`.github/workflows/deploy.yml`, which rsyncs the source to the VPS, builds
there, and restarts the API — see [§7](#7-deploying-updates). Sections 0–6
describe provisioning a *fresh* box; on the existing server they are reference
only.

---

## 0. Prerequisites

- Ubuntu 22.04+/Debian VPS, NGINX already installed and running
- A domain or subdomain pointed at the VPS (e.g. `simo-konibatam.com`)
- Root or sudo access

Install Node.js and PM2 (the live server runs Node 24):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git rsync
sudo npm install -g pm2
```

PostgreSQL — either:
- use the managed/remote Postgres URL already configured in your `.env`
  (no extra install needed), **or**
- install Postgres locally:

```bash
sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE USER koni WITH PASSWORD 'change-me';"
sudo -u postgres psql -c "CREATE DATABASE koni_batam OWNER koni;"
```

---

## 1. Get the code

The source lives in the deploy user's home directory, and the built SPA is
copied to the NGINX web root — they are two different places:

| Path | Contents |
| --- | --- |
| `/home/ubuntu/inasportdb` | full source + `node_modules`, where builds run |
| `/var/www/konibatam` | built SPA only (`apps/web/dist` copied here) |

```bash
git clone <your-repo-url> ~/inasportdb
cd ~/inasportdb
sudo mkdir -p /var/www/konibatam
sudo chown $USER:$USER /var/www/konibatam
```

> **The VPS copy is not a git repository.** The deploy workflow rsyncs with
> `--exclude '.git'`, so after the first automated deploy `~/inasportdb` is a
> plain working copy — `git pull` there will fail, and that is expected. `main`
> on GitHub is the source of truth; see [§7](#7-deploying-updates).

---

## 2. Configure environment

The API reads `apps/api/.env`; the web build reads `.env.production` at the
repo root. Both are excluded from the deploy rsync, so they persist across
deploys and must be created once, by hand, on the server.

**`apps/api/.env`** — the API process and the Prisma CLI both read this:

```ini
DATABASE_URL="postgresql://<user>:<pass>@<host>:<port>/<db>?schema=public"

JWT_ACCESS_SECRET="<generate with: openssl rand -hex 32>"
JWT_REFRESH_SECRET="<generate with: openssl rand -hex 32>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

PORT=4100

API_BASE_URL="https://api.simo-konibatam.com"
CLIENT_URL="https://simo-konibatam.com"
APP_BASE_URL="https://simo-konibatam.com"
PUBLIC_SITE_URL="https://simo-konibatam.com"

# Relative to the API's working directory -> /home/ubuntu/inasportdb/apps/api/uploads
UPLOAD_DIR="./uploads"

# Written into the NGINX web root so the public sitemap is served statically
SITEMAP_PATH=/var/www/konibatam/sitemap.xml

SMTP_HOST="..."
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="no-reply@simo-konibatam.com"
```

**`.env.production`** (repo root) — Vite inlines this at build time, so the
API URL is baked into the bundle and is *not* read at runtime:

```ini
VITE_API_BASE_URL="https://api.simo-konibatam.com/api/v1"
```

> The deploy workflow rewrites `.env.production` on every run from the
> `VITE_API_BASE_URL` GitHub secret. Editing it on the server alone will be
> overwritten on the next deploy — change the secret instead.

Production Postgres is an external managed instance, not local to the VPS, so
the `apt-get install postgresql` step in §0 is not needed here.

---

## 3. Install, build, migrate, seed

```bash
npm install

# Run Prisma from apps/api so it picks up apps/api/.env. Passing --schema with
# a relative path from the repo root does not work with --workspace, since that
# flag changes the working directory.
cd apps/api
npx prisma generate
npx prisma db push        # this project uses db push, not migrations
npx prisma db seed        # initial admin users — change passwords after first login!
cd ../..

npm run build   # builds shared-types, apps/api -> dist/, apps/web -> dist/
```

Create the uploads directory referenced by `UPLOAD_DIR`. It is relative to the
API's working directory, and is excluded from the deploy rsync so uploaded
files survive deploys:

```bash
mkdir -p ~/inasportdb/apps/api/uploads
```

---

## 4. Run the API with PM2

```bash
cd ~/inasportdb
pm2 start apps/api/dist/server.js --name koni-api --cwd apps/api
pm2 save
pm2 startup   # follow the printed command to enable PM2 on boot
```

The process name is **`koni-api`** — the deploy workflow restarts it by that
exact name, so renaming it breaks deploys.

The API listens on `127.0.0.1:4100` (per `PORT` in `apps/api/.env`) — it should
**not** be exposed directly to the internet; NGINX proxies to it.

Check it's up:

```bash
curl http://127.0.0.1:4100/health
# {"status":"ok"}
```

---

## 5. NGINX site config

Two site files are in use. Both already exist on the live server — the
authoritative copies are on the box, and the snippets below are abridged to the
parts that matter.

**`/etc/nginx/sites-available/simo-konibatam`** — the domain vhosts. The SPA
and the API are separate `server` blocks on separate hostnames:

```nginx
# Web — static SPA
server {
    server_name simo-konibatam.com www.simo-konibatam.com;
    root /var/www/konibatam;
    index index.html;

    # Must be >= the largest multer limit in the API (athlete Excel import: 50 MB).
    client_max_body_size 50m;

    location /uploads/ { proxy_pass http://127.0.0.1:4100; }
    location /assets/  { expires 30d; add_header Cache-Control "public, immutable"; try_files $uri =404; }
    location /         { add_header Cache-Control "no-cache"; try_files $uri $uri/ /index.html; }

    listen 443 ssl;   # managed by Certbot
}

# API — everything proxied to the pm2 koni-api process
server {
    server_name api.simo-konibatam.com;
    client_max_body_size 50m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / { proxy_pass http://127.0.0.1:4100; }

    listen 443 ssl;   # managed by Certbot
}
```

**`/etc/nginx/sites-available/konibatam`** — the IP-based fallback, kept in
place so the app stays reachable at the bare IP if DNS or TLS is broken. It is
`listen 80 default_server` with `server_name _`, serves the same
`/var/www/konibatam` root, and proxies `/api`, `/uploads`, `/socket.io` and
`/health` to `127.0.0.1:4100`.

Both files set `client_max_body_size 50m` (three occurrences in total). All of
them must be raised together, or a large athlete import will 413 depending on
which hostname it arrives through.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/konibatam      /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/simo-konibatam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. HTTPS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d simo-konibatam.com
```

Certbot edits the NGINX config to add the `listen 443 ssl` block and sets up
auto-renewal. After this, double-check `.env`'s `VITE_API_BASE_URL`,
`API_BASE_URL`, and `CARD_VERIFY_BASE_URL` use `https://` — if you change
them, rebuild the web app (`npm run -w apps/web build`) since Vite inlines
env vars at build time.

---

## 7. Deploying updates

**Push to `main`.** That is the whole procedure —
`.github/workflows/deploy.yml` does the rest. Do not deploy by hand; the
workflow rsyncs with `--delete`, so anything applied manually on the VPS is
reverted on the next deploy.

The workflow, on every push to `main` (or via **Run workflow** for
`workflow_dispatch`):

1. rsyncs the source to `~/inasportdb`, excluding `node_modules`, `dist`,
   `.git`, `.env*`, and `uploads`
2. writes `.env.production` from the `VITE_API_BASE_URL` secret
3. `npm install`
4. `npx prisma generate`
5. `npx prisma db push` from `apps/api` — **no** `--accept-data-loss`, so a
   destructive schema change fails the deploy instead of dropping data
6. `npm run build`
7. generates `sitemap.xml` into the web root
8. `rsync -a --delete apps/web/dist/ /var/www/konibatam/`
9. `pm2 restart koni-api --update-env && pm2 save`
10. polls `http://127.0.0.1:4100/health` up to 10 times, failing the deploy if
    it never returns 200

Deploys are serialised by a `concurrency` group, so two pushes queue rather
than interleave.

Required repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`,
`VITE_API_BASE_URL`.

Watch a deploy:

```bash
gh run list --workflow=deploy.yml --limit 3
gh run watch <run-id> --exit-status
```

NGINX is **not** touched by the workflow. Config changes under `/etc/nginx`
are made on the server and survive deploys:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Manual deploy (emergency only)

If Actions is unavailable, mirror the workflow from a clone — never edit source
on the VPS in place:

```bash
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude '.env*' --exclude uploads \
  ./ ubuntu@<vps-host>:/home/ubuntu/inasportdb/

ssh ubuntu@<vps-host> '
  cd ~/inasportdb &&
  npm install &&
  ( cd apps/api && npx prisma generate && npx prisma db push --skip-generate ) &&
  npm run build &&
  ( cd apps/api && npx tsx prisma/generate-sitemap.ts ) &&
  rsync -a --delete apps/web/dist/ /var/www/konibatam/ &&
  pm2 restart koni-api --update-env && pm2 save &&
  curl -s -o /dev/null -w "health %{http_code}\n" http://127.0.0.1:4100/health
'
```

Push the same commit to `main` afterwards, or the next deploy will revert it.

---

## 8. Mobile (Capacitor) builds

The SPA is shared with the mobile webview build (Phase 6). When building the
mobile app, point `VITE_API_BASE_URL` at `https://api.simo-konibatam.com/api/v1`
and any verify links at `https://simo-konibatam.com/verify`, so the packaged app
talks to this VPS over the internet — there is no separate mobile backend.

---

## Troubleshooting

- **502 from the API**: check `pm2 status` and `pm2 logs koni-api` — the
  process may have crashed (often a bad `DATABASE_URL` or a missing
  `apps/api/.env`).
- **Blank page / 404 on refresh of `/dashboard`**: confirm the `location /`
  block uses `try_files $uri $uri/ /index.html;` (SPA fallback).
- **File uploads 413**: raise `client_max_body_size` in **both** site files
  (three occurrences) and reload NGINX. It must be at least as large as the
  API's multer limit — currently 50 MB for the athlete import.
- **A change deployed and then disappeared**: it was applied directly on the
  VPS and the next deploy's `rsync --delete` reverted it. Land it on `main`.
- **`git pull` fails on the VPS**: expected — the deploy rsync excludes
  `.git`, so `~/inasportdb` is a working copy, not a repository.
- **QR codes / verify links point to `localhost`**: `VITE_API_BASE_URL` is
  inlined at build time, not read at runtime. Fix the GitHub secret and
  redeploy; editing `.env.production` on the server is overwritten each deploy.
