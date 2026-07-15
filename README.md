# TR–1 · daily routine tracker

A daily checklist app with a Teenage-Engineering-inspired interface.
Add your routine actions, check them off each day, and watch your history,
streaks and records build up. All your data stays on your device —
no account, no cloud, no tracking.

## Features

- **Local profile** — enter your name and birthdate once; the app shows your name and age
- **Today** — add actions, check them off with chunky orange buttons, VU-meter progress bar
- **Edit your routine** — tap a name to rename, ▲▼ to reorder, × to remove (history kept)
- **History** — 12-week heatmap (GitHub-contribution style) + recent day log
- **Records** — current streak, best streak, perfect days, total check-ins, per-action 30-day completion rates
- **Settings** — edit profile, daily reminder notification, JSON export/import backup, clear all actions
- **Private by design** — everything lives in the browser's localStorage; the server only hosts files
- **Installable** — works offline; add to home screen on iPhone/Android/desktop (PWA)

## Stack

- Frontend: plain HTML/CSS/JS, no framework, no build step (in `public/`)
- Backend: Node.js + Express (`server.js`) — static file hosting only
- Hosting: Render free tier, deployed straight from this GitHub repo

## Run locally

```
npm install
node server.js
```

Open http://localhost:8080

## Deploy (free)

1. On [render.com](https://render.com) → New → Blueprint → pick this repo
   (`render.yaml` configures everything)
2. Done — Render redeploys automatically on every `git push`

## Install on iPhone

1. Open the deployed URL in **Safari**
2. Tap **Share → Add to Home Screen**
3. It launches full-screen like a native app

## Backups

Your data lives only on your device. Use **Settings → export json** to save a
backup file, and **import json** to restore it (or move to a new phone).
