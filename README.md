# TR–1 · daily routine tracker

A daily checklist app with a Teenage-Engineering-inspired interface.
Add your routine actions, check them off each day, and watch your history,
streaks and records build up. Create an account and your records sync
across all your devices — or use it offline with no account at all.

## Features

- **Today** — add actions, check them off with chunky orange buttons, VU-meter progress bar
- **Edit your routine** — tap a name to rename, ▲▼ to reorder, × to remove (history kept)
- **History** — 12-week heatmap (GitHub-contribution style) + recent day log
- **Records** — current streak, best streak, perfect days, total check-ins, per-action 30-day completion rates
- **Settings** — daily reminder notification, JSON export/import backup
- **Accounts + cloud sync** — sign up with a username, records follow you across devices
- **Offline mode** — works with no account; installable on iPhone/Android/desktop (PWA)

## Stack

- Frontend: plain HTML/CSS/JS, no framework, no build step (in `public/`)
- Backend: Node.js + Express (`server.js`) — register/login (bcrypt + JWT) and per-user data sync
- Database: Postgres (Neon free tier) — falls back to in-memory store for local dev
- Hosting: Render free tier, deployed straight from this GitHub repo

## Run locally

```
npm install
node server.js
```

Open http://localhost:8080 — no database needed for dev (uses an in-memory
store; accounts reset when the server restarts).

## Deploy (all free)

1. **Database**: create a free Postgres at [neon.tech](https://neon.tech), copy the connection string
2. **Server**: on [render.com](https://render.com) → New → Blueprint → pick this repo
   (`render.yaml` configures everything) → paste the connection string as `DATABASE_URL`
3. Done — Render redeploys automatically on every `git push`

## Install on iPhone

1. Open the deployed URL in **Safari**
2. Tap **Share → Add to Home Screen**
3. It launches full-screen like a native app

## Environment variables

| var | purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `JWT_SECRET` | signs login tokens (Render auto-generates) |
| `NODE_ENV` | `production` on Render |
