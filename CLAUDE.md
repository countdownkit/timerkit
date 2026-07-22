# CLAUDE.md — timerkit

Project instructions for Claude Code working in this repo. Inherits the ElevatedProgress
venture playbook from the parent folder's CLAUDE.md.

## What this is

A zero-dependency static-site generator for **free online timers** — countdown timer,
stopwatch, Pomodoro, and interval (HIIT) timer. `generate.js` reads `data/timers.json` +
`assets/` and writes one page per timer into `public/`. Target:
https://timer.elevatedprogress.com/. Unlike the printable tools in this venture, this one is
**interactive**: the tool runs in the browser. Mass-generatable **preset minute timers**
(`/5-minute-timer/`, `/10-minute-timer/`, …) are the long-tail ranking engine.

## The product rule

**The tool IS the page.** Each page server-renders the real UI with the correct starting
value (SEO + works with JS off); `assets/tool.js` then makes it live. Never turn this into a
JS-only app that renders an empty shell — the server-rendered display value is what ranks.

- **Accurate timing, always.** Countdowns/intervals compute `remaining = endTime - Date.now()`
  and stopwatches compute `elapsed = Date.now() - startAt`. Never accumulate `setInterval`
  ticks as the source of truth — that drifts and breaks in background tabs. `setInterval` is
  only the repaint clock.
- **Self-contained.** No external requests, no CDN, no audio files. The end-of-timer alarm is
  synthesized with WebAudio (`assets/tool.js`). Keep it that way.
- `assets/timer.js` is a UMD module (`fmt`, `fmtStop`, `words`) required by BOTH `generate.js`
  (server render) and `tool.js` (browser) so their output matches exactly — same pattern as
  calendarkit's `cal.js`.

## Kinds (one `tool.js`, switched on `data-kind`)

- `countdown` — counts down from `data-seconds`; custom pages expose H/M/S inputs, presets are
  fixed. Alarm + flash at zero; quick +1:00 / +5:00.
- `stopwatch` — counts up with laps.
- `interval` — repeating work/break rounds with a round counter; drives BOTH the Pomodoro
  timer (25/5, long break) and the HIIT interval timer. Config from `data-work/-break/-rounds/
  -longbreak/-worklabel/-breaklabel`.

## Deploy — just push

`git push` to `main` is the deploy — GitHub Actions (`.github/workflows/deploy.yml`).

- **Never manually build and commit output.** `public/` is git-ignored build output.
- **Never hand-edit anything in `public/`.**
- Commit as the neutral identity:
  `git -c user.name="timerkit" -c user.email="timerkit@users.noreply.github.com" commit …`

## Local build / preview

```
node generate.js     # writes ./public
node server.js       # preview at http://localhost:5078 (5060/5061 are Chrome-blocked SIP ports)
```

## Don't break these (generated, must keep serving)

- `ads.txt` + AdSense loader in `<head>` — publisher `ca-pub-5580575158570188`.
- GA4 `G-TJY4TRRKD6` (shared across all EP sites; hostname splits them).
- `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME` (timer.elevatedprogress.com).
- GSC verification file once the property is verified.

## Config knobs

`DOMAIN` and `BASE`, same semantics as the other tools. Production values in the workflow.
Add a new timer = a row in `data/timers.json` (or a minute in `presetMinutes`).
