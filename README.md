# TR–1 · daily routine tracker

A minimal daily checklist app with a Teenage-Engineering-inspired interface.
Add your routine actions, check them off each day, and watch your history,
streaks and records build up.

Built as a Progressive Web App (PWA): plain HTML/CSS/JS, no framework,
no build step, no server. All data stays in your browser (localStorage).

## Features

- **Today** — add actions, check them off with chunky orange buttons, VU-meter progress bar
- **History** — 12-week heatmap (GitHub-contribution style) + recent day log
- **Records** — current streak, best streak, perfect days, total check-ins, per-action 30-day completion rates
- Works offline (service worker), installable on iPhone/Android/desktop

## Run locally

Any static file server works:

```
python -m http.server 8080
```

Then open http://localhost:8080

## Install on iPhone

1. Open the deployed URL in **Safari**
2. Tap the **Share** button → **Add to Home Screen**
3. It launches full-screen like a native app and works offline

## Deploy

Hosted free on GitHub Pages — push to `main` and it's live.
