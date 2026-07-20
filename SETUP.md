# VPS Deployment Guide (NGINX)

This guide deploys the KONI Batam app on a single Ubuntu/Debian VPS that
already has **NGINX installed**. The Express API runs as a Node process
(managed by PM2) on `127.0.0.1:4000`; the React SPA is built to static files
and served by NGINX, which also reverse-proxies `/api/v1` and `/uploads` to
the API.

```
Browser ──► NGINX (443/80)
              ├─ /            → static files: apps/web/dist
              ├─ /api/v1/*    → proxy_pass http://127.0.0.1:4000
              ├─ /uploads/*   → proxy_pass http://127.0.0.1:4000
              └─ /verify/*    → static files (SPA route, see below)
```

---

## 0. Prerequisites

- Ubuntu 22.04+/Debian VPS, NGINX already installed and running
- A domain or subdomain pointed at the VPS (e.g. `simo-konibatam.com`)
- Root or sudo access

Install Node.js 22 (via NodeSource) and PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
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

```bash
sudo mkdir -p /var/www/inasportdb
sudo chown $USER:$USER /var/www/inasportdb
git clone <your-repo-url> /var/www/inasportdb
cd /var/www/inasportdb
```

---

## 2. Configure environment

```bash
cp .env.example .env
nano .env
```

Set production values (replace `simo-konibatam.com` with your domain):

```ini
DATABASE_URL="postgresql://koni:change-me@localhost:5432/koni_batam?schema=public"

JWT_ACCESS_SECRET="<generate with: openssl rand -hex 32>"
JWT_REFRESH_SECRET="<generate with: openssl rand -hex 32>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

PORT=4000
API_BASE_URL="https://simo-konibatam.com/api/v1"

# Built into the SPA at build time — must point at the public API path
VITE_API_BASE_URL="https://simo-konibatam.com/api/v1"

UPLOAD_DIR="/var/www/inasportdb/uploads"

# Used to build QR codes for the digital athlete card
CARD_VERIFY_BASE_URL="https://simo-konibatam.com/verify"
```

> `apps/api` also needs its own `.env` (Prisma CLI reads `.env` from its own
> directory, not the repo root):
>
> ```bash
> cp .env apps/api/.env
> ```

---

## 3. Install, build, migrate, seed

```bash
npm install
npm run -w apps/api prisma:generate

# If your DB user has CREATEDB permission:
npm run -w apps/api prisma:migrate -- --name init
# Otherwise (e.g. shared hosting DB without CREATEDB):
npx --workspace=apps/api prisma db push

npm run -w apps/api prisma:seed   # creates initial admin users — change passwords after first login!

npm run build   # builds shared-types, apps/api -> dist/, apps/web -> dist/
```

Create the uploads directory referenced by `UPLOAD_DIR`:

```bash
mkdir -p /var/www/inasportdb/uploads
```

---

## 4. Run the API with PM2

```bash
cd /var/www/inasportdb
pm2 start apps/api/dist/server.js --name inasportdb-api --cwd apps/api
pm2 save
pm2 startup   # follow the printed command to enable PM2 on boot
```

The API listens on `127.0.0.1:4000` (per `PORT` in `.env`) — it should **not**
be exposed directly to the internet; NGINX will proxy to it.

Check it's up:

```bash
curl http://127.0.0.1:4000/health
# {"status":"ok"}
```

---

## 5. NGINX site config

Create `/etc/nginx/sites-available/inasportdb`:

```nginx
server {
    listen 80;
    server_name simo-konibatam.com;

    root /var/www/inasportdb/apps/web/dist;
    index index.html;

    # Must be >= the largest multer limit in the API (athlete Excel import: 50 MB).
    client_max_body_size 50m;

    # API
    location /api/v1/ {
        proxy_pass http://127.0.0.1:4000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files (athlete photos, documents, certificates)
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_set_header Host $host;
    }

    # SPA — serve static files, fall back to index.html for client-side routing
    # (covers /login, /dashboard, /verify/:cardCode, etc.)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-term caching for hashed Vite assets
    location /assets/ {
        try_files $uri =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site and reload NGINX:

```bash
sudo ln -s /etc/nginx/sites-available/inasportdb /etc/nginx/sites-enabled/inasportdb
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

```bash
cd /var/www/inasportdb
git pull
npm install
npm run -w apps/api prisma:generate
npx --workspace=apps/api prisma db push   # or prisma:migrate if using migrations
npm run build
pm2 restart inasportdb-api
sudo systemctl reload nginx   # only needed if the NGINX config itself changed
```

---

## 8. Mobile (Capacitor) builds

The SPA is shared with the mobile webview build (Phase 6). When building the
mobile app, point `VITE_API_BASE_URL` and `CARD_VERIFY_BASE_URL` at the same
production domain (`https://simo-konibatam.com/...`) so the packaged app talks
to this VPS over the internet — there is no separate mobile backend.

---

## Troubleshooting

- **502 from `/api/v1/...`**: check `pm2 status` and `pm2 logs
  inasportdb-api` — the API process may have crashed (often a bad
  `DATABASE_URL` or missing `.env`).
- **Blank page / 404 on refresh of `/dashboard`**: confirm the `location /`
  block uses `try_files $uri $uri/ /index.html;` (SPA fallback).
- **File uploads 413**: increase `client_max_body_size` in the NGINX server
  block.
- **QR codes / verify links point to `localhost`**: rebuild `apps/web` after
  fixing `CARD_VERIFY_BASE_URL` and `VITE_API_BASE_URL` in `.env` — these are
  baked in at build time, not read at runtime.
