/*
 * Static generator for the online timer site.
 * Run: node generate.js   ->   writes everything into ./public
 *
 * Page families (all interactive — the tool IS the page):
 *   /timer/, /countdown-timer/, /egg-timer/   custom countdown timers (set H/M/S)
 *   /N-minute-timer/                           preset countdowns (default = N:00)
 *   /stopwatch/                                count-up stopwatch with laps
 *   /pomodoro-timer/, /interval-timer/         repeating work/break interval timers
 *   /                                          homepage grid
 *
 * The UI is server-rendered (correct starting value for SEO + no-JS), then
 * assets/tool.js makes it live. Timing is computed against the real clock
 * (Date.now / endTime), so it never drifts like a naive setInterval counter.
 * Everything is self-contained: no external requests, no audio assets (the alarm
 * is WebAudio-synthesized).
 */
const fs = require("fs");
const path = require("path");
const T = require("./assets/timer.js");

// ---- config -------------------------------------------------------------
const DOMAIN = process.env.DOMAIN || "https://timer.elevatedprogress.com";
const BASE = process.env.BASE || "";
const SITE = "Timer";
const OUT = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "timers.json"), "utf8"));

// ---- html layout --------------------------------------------------------
function layout({ title, desc, urlPath, h1, body }) {
  const canonical = DOMAIN + BASE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE}/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5580575158570188" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TJY4TRRKD6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-TJY4TRRKD6');</script>
</head>
<body>
<header class="site-head"><div class="wrap">
  <a class="brand" href="${BASE}/">⏲️ ${SITE}</a>
  <nav class="nav"><a href="${BASE}/#timers">Timers</a><a href="${BASE}/#presets">Presets</a><a href="${BASE}/#stopwatch">Stopwatch</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs"><a href="${BASE}/">Home</a> ›&nbsp;${h1}</div>
  <h1>${h1}</h1>
  ${body}
</main>
<footer class="site-foot"><div class="wrap">
  <a href="${BASE}/">Home</a><a href="${BASE}/#timers">Timers</a><a href="${BASE}/#presets">Preset timers</a><a href="${BASE}/#stopwatch">Stopwatch &amp; Pomodoro</a>
  <span>· ${SITE} — free online timers, stopwatch, and Pomodoro. No downloads, no signup: everything runs in your browser. Part of <a href="https://elevatedprogress.com/">Elevated Progress</a>. · <a href="https://elevatedprogress.com/privacy/">Privacy Policy</a></span>
</div></footer>
<script src="${BASE}/timer.js"></script>
<script src="${BASE}/tool.js" defer></script>
</body>
</html>`;
}

function grid(links) {
  return `<div class="grid">` + links.map(l =>
    `<a href="${BASE}${l.href}">${l.emoji ? `<span class="chip-emoji">${l.emoji}</span>` : ""}${l.label}</a>`).join("") + `</div>`;
}

// ---- tool UI (server-rendered, tool.js re-renders it live) ---------------
function hmsInputs(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `<div class="setrow">
    <div><label for="in-h">Hours</label><input type="number" id="in-h" min="0" max="99" step="1" value="${h}" data-in="h"></div>
    <div><label for="in-m">Minutes</label><input type="number" id="in-m" min="0" max="59" step="1" value="${m}" data-in="m"></div>
    <div><label for="in-s">Seconds</label><input type="number" id="in-s" min="0" max="59" step="1" value="${s}" data-in="s"></div>
  </div>`;
}

function alarmToggle() {
  return `<label class="alarm"><input type="checkbox" data-ctl="alarm" checked> Alarm sound when the timer ends</label>`;
}

function countdownTool(p) {
  const secs = p.seconds;
  const inputs = p.custom ? hmsInputs(secs) : "";
  return `<div class="tool" data-tool data-kind="countdown" data-seconds="${secs}" data-custom="${p.custom ? 1 : 0}" data-name="${p.name}">
    <div class="display" data-display>${T.fmt(secs)}</div>
    ${inputs}
    <div class="btns">
      <button type="button" class="btn primary" data-act="startpause">Start</button>
      <button type="button" class="btn" data-act="reset">Reset</button>
      <button type="button" class="btn" data-act="plus" data-sec="60">+1:00</button>
      <button type="button" class="btn" data-act="plus" data-sec="300">+5:00</button>
      <button type="button" class="btn stop" data-act="stop" hidden>Stop alarm</button>
    </div>
    ${alarmToggle()}
  </div>`;
}

function stopwatchTool(p) {
  return `<div class="tool" data-tool data-kind="stopwatch" data-name="${p.name}">
    <div class="display" data-display>00:00.00</div>
    <div class="btns">
      <button type="button" class="btn primary" data-act="startpause">Start</button>
      <button type="button" class="btn" data-act="lap">Lap</button>
      <button type="button" class="btn" data-act="reset">Reset</button>
    </div>
    <ol class="laps" data-laps></ol>
  </div>`;
}

function msInputs(id, label, secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `<div><label for="${id}-m">${label} min</label><input type="number" id="${id}-m" min="0" max="99" step="1" value="${m}" data-in="${id}-m"></div>
    <div><label for="${id}-s">${label} sec</label><input type="number" id="${id}-s" min="0" max="59" step="1" value="${s}" data-in="${id}-s"></div>`;
}

function intervalTool(p) {
  const long = p.longBreak || 0;
  return `<div class="tool" data-tool data-kind="interval" data-work="${p.work}" data-break="${p.break}" data-longbreak="${long}" data-rounds="${p.rounds}" data-worklabel="${p.workLabel}" data-breaklabel="${p.breakLabel}" data-name="${p.name}">
    <div class="phase" data-phase>${p.workLabel}</div>
    <div class="display" data-display>${T.fmt(p.work)}</div>
    <div class="cycle" data-cycle>Round 1 of ${p.rounds}</div>
    <div class="setrow">
      ${msInputs("work", p.workLabel, p.work)}
      ${msInputs("break", p.breakLabel, p.break)}
      <div><label for="in-r">Rounds</label><input type="number" id="in-r" min="1" max="20" step="1" value="${p.rounds}" data-in="rounds"></div>
    </div>
    <div class="btns">
      <button type="button" class="btn primary" data-act="startpause">Start</button>
      <button type="button" class="btn" data-act="reset">Reset</button>
      <button type="button" class="btn" data-act="skip">Skip</button>
      <button type="button" class="btn stop" data-act="stop" hidden>Stop alarm</button>
    </div>
    ${alarmToggle()}
  </div>`;
}

function toolUI(p) {
  if (p.kind === "stopwatch") return stopwatchTool(p);
  if (p.kind === "interval") return intervalTool(p);
  return countdownTool(p);
}

// ---- write helpers ------------------------------------------------------
const urls = [];
function writePage(urlPath, html) {
  const dir = path.join(OUT, urlPath.replace(/^\/+|\/+$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  urls.push(urlPath);
}

// ---- link builders ------------------------------------------------------
const presetLink = min => ({ href: `/${min}-minute-timer/`, label: `${min} Minute Timer` });
const pageLink = p => ({ href: `/${p.slug}/`, emoji: p.emoji, label: p.name });

const TIMER_LINKS = DATA.timers.map(pageLink);
const PRESET_LINKS = DATA.presetMinutes.map(presetLink);
const SPECIAL_LINKS = DATA.special.map(pageLink);
const ALL_LINKS = TIMER_LINKS.concat(PRESET_LINKS, SPECIAL_LINKS);

// A "more timers" grid for each page: everything except the current page.
function relatedFor(slug) {
  return ALL_LINKS.filter(l => l.href !== `/${slug}/`);
}

// ---- page builder -------------------------------------------------------
function toolPage({ slug, kind, page, h1, title, desc, blurb, tip, howto }) {
  const body = `${toolUI(page)}
  <div class="ad-slot">Advertisement</div>
  <div class="prose">
    ${blurb ? `<p>${blurb}</p>` : ""}
    ${tip ? `<p>${tip}</p>` : ""}
    ${howto ? `<p>${howto}</p>` : ""}
  </div>
  <h2>More online timers</h2>
  ${grid(relatedFor(slug))}
  <div class="ad-slot">Advertisement</div>`;
  writePage(`/${slug}/`, layout({ title, desc, urlPath: `/${slug}/`, h1, body }));
}

const HOWTO_COUNTDOWN = `<b>How it works:</b> press Start to begin the countdown, Pause to hold it, and Reset to return to the set time. The +1:00 and +5:00 buttons add time on the fly. When it reaches zero the display flashes and an alarm beeps until you press Stop — turn the alarm off with the checkbox if you want a silent timer. The tab title shows the time remaining so you can watch it from another tab.`;

// ---- build --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const entry of fs.readdirSync(OUT)) {
  if (entry === ".git" || entry === "CNAME") continue;
  fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));

// custom + interval timers (from data)
for (const p of DATA.timers) {
  const kindWord = p.kind === "interval" ? "interval timer" : "timer";
  toolPage({
    slug: p.slug, kind: p.kind, page: p,
    h1: p.h1,
    title: `${p.name} — Free Online ${p.kind === "interval" ? "Interval Timer" : "Countdown Timer"}`,
    desc: `${p.blurb.split(". ")[0]}. Free, no signup, runs in your browser.`,
    blurb: p.blurb, tip: p.tip,
    howto: p.kind === "interval" ? "" : HOWTO_COUNTDOWN,
  });
}

// preset minute timers (mass-generated — the ranking engine)
for (const min of DATA.presetMinutes) {
  const secs = min * 60;
  const label = `${min} Minute Timer`;
  const page = { slug: `${min}-minute-timer`, kind: "countdown", custom: false, seconds: secs, name: label };
  toolPage({
    slug: page.slug, kind: "countdown", page,
    h1: `${min} Minute Timer`,
    title: `${min} Minute Timer — Online Countdown (Free, Full Screen)`,
    desc: `A free online ${min} minute timer. It starts at ${T.fmt(secs)} — just press Start and it counts down to zero with an alarm. No signup, works in your browser.`,
    blurb: `A ${min}-minute countdown timer set and ready to go: the display already shows ${T.fmt(secs)}, so all you do is press Start. When the ${min} minutes are up it flashes and sounds an alarm.`,
    tip: `Need a slightly different time? Use the +1:00 or +5:00 buttons to extend it, or pick another preset below. Prefer a fully custom time? The main ${"timer"} lets you set exact hours, minutes, and seconds.`,
    howto: HOWTO_COUNTDOWN,
  });
}

// stopwatch + pomodoro (from data.special)
for (const p of DATA.special) {
  const isStop = p.kind === "stopwatch";
  toolPage({
    slug: p.slug, kind: p.kind, page: p,
    h1: p.h1,
    title: isStop ? `Online Stopwatch — Free, with Laps (Full Screen)` : `Pomodoro Timer — Online 25/5 Focus Timer (Free)`,
    desc: `${p.blurb.split(". ")[0]}. Free, no signup, runs in your browser.`,
    blurb: p.blurb, tip: p.tip,
    howto: isStop ? `<b>How it works:</b> press Start to run the clock, Lap to record a split without stopping, and Reset to clear it. The stopwatch times against the real clock, so it stays accurate even in a background tab.` : "",
  });
}

// -- homepage --
{
  const title = `Online Timer — Free Countdown Timer, Stopwatch &amp; Pomodoro`;
  const desc = `Free online timers that run in your browser: set a countdown timer, use a ready-made minute timer, run a stopwatch with laps, or start a Pomodoro focus timer. No downloads, no signup.`;
  const body = `<p class="lead">Free, full-screen timers that run entirely in your browser — no downloads, no account. Pick a preset, set your own countdown, time laps with the stopwatch, or run focus sessions with the Pomodoro timer. Each one keeps accurate time and beeps when it's done.</p>
  <h2 id="timers">Timers</h2>
  ${grid(TIMER_LINKS)}
  <h2 id="presets">Preset minute timers</h2>
  ${grid(PRESET_LINKS)}
  <h2 id="stopwatch">Stopwatch &amp; Pomodoro</h2>
  ${grid(SPECIAL_LINKS)}
  <div class="ad-slot">Advertisement</div>
  <div class="prose"><p>These are working tools, not articles: the timer you see on each page is the one that runs. Timing is computed against your device clock rather than counted tick-by-tick, so a five-minute timer really lasts five minutes even if the tab drops to the background. The end-of-timer alarm is synthesized in the browser — there's no audio file to load and nothing leaves your device.</p></div>`;
  writePage(`/`, layout({ title, desc, urlPath: `/`, h1: `Free Online Timer`, body }));
}

// -- sitemap + robots + meta files --
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${DOMAIN}${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "CNAME"), "timer.elevatedprogress.com\n");
fs.writeFileSync(path.join(OUT, "ads.txt"), "google.com, pub-5580575158570188, DIRECT, f08c47fec0942fa0\n");

console.log(`Generated ${urls.length} pages into ./public`);
