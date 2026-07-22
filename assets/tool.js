/*
 * Live timer engine. The display is server-rendered for SEO / no-JS; this makes
 * it interactive. Three kinds share one file:
 *   countdown  — counts down from a set duration, alarm at zero
 *   stopwatch  — counts up with laps
 *   interval   — repeating work/break rounds (Pomodoro + HIIT), beep per switch
 *
 * Timing is computed from timestamps (endTime / startAt vs Date.now()), never by
 * accumulating setInterval ticks, so it doesn't drift and survives a background
 * tab. The alarm is synthesized with WebAudio — no audio asset is loaded.
 */
(function () {
  const T = window.TIMER;
  const root = document.querySelector("[data-tool]");
  if (!root || !T) return;

  const kind = root.dataset.kind;
  const name = root.dataset.name || "Timer";
  const display = root.querySelector("[data-display]");
  const baseTitle = document.title;
  const act = a => root.querySelector(`[data-act=${a}]`);
  const alarmOn = () => {
    const box = root.querySelector("[data-ctl=alarm]");
    return !box || box.checked;
  };

  function setTitle(s) { document.title = s ? s + " · " + name : baseTitle; }

  // ---- alarm (WebAudio, synthesized beep loop) --------------------------
  let audioCtx = null, alarmTimer = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep(freq, dur) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq || 880;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.18));
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.18) + 0.02);
  }
  function pip() { ensureAudio(); if (alarmOn()) { beep(1046, 0.12); } }
  function startAlarm() {
    root.classList.add("ringing");
    const stopBtn = act("stop");
    if (stopBtn) stopBtn.hidden = false;
    if (!alarmOn()) return;
    ensureAudio();
    if (alarmTimer) return;
    const ring = () => { beep(880, 0.16); setTimeout(() => beep(1174, 0.16), 220); };
    ring();
    alarmTimer = setInterval(ring, 900);
  }
  function stopAlarm() {
    root.classList.remove("ringing");
    const stopBtn = act("stop");
    if (stopBtn) stopBtn.hidden = true;
    if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
  }
  const stopBtn = act("stop");
  if (stopBtn) stopBtn.addEventListener("click", stopAlarm);

  const startPauseBtn = act("startpause");
  function setStartLabel(txt) { if (startPauseBtn) startPauseBtn.textContent = txt; }

  // ===== COUNTDOWN =======================================================
  if (kind === "countdown") {
    const custom = root.dataset.custom === "1";
    let baseSec = +root.dataset.seconds || 0;   // the reset target, in seconds
    let remaining = baseSec * 1000;             // ms left
    let endTime = 0, running = false, ticker = null;

    const inH = root.querySelector("[data-in=h]");
    const inM = root.querySelector("[data-in=m]");
    const inS = root.querySelector("[data-in=s]");

    function readInputs() {
      const h = Math.max(0, Math.min(99, +inH.value || 0));
      const m = Math.max(0, Math.min(59, +inM.value || 0));
      const s = Math.max(0, Math.min(59, +inS.value || 0));
      return h * 3600 + m * 60 + s;
    }
    function render() {
      const secs = Math.ceil(remaining / 1000);
      display.textContent = T.fmt(secs);
      setTitle(running ? T.fmt(secs) : "");
    }
    function tick() {
      remaining = endTime - Date.now();
      if (remaining <= 0) {
        remaining = 0; render();
        clearInterval(ticker); ticker = null; running = false;
        setStartLabel("Start"); setTitle("Time's up");
        display.textContent = "0:00";
        startAlarm();
        return;
      }
      render();
    }
    function start() {
      if (running) return;
      if (remaining <= 0) remaining = baseSec * 1000;
      if (remaining <= 0) return;
      stopAlarm();
      ensureAudio();
      endTime = Date.now() + remaining;
      running = true;
      if (typeof window.gtag === "function") window.gtag("event", "tool_use", { action: "start" });
      setStartLabel("Pause");
      ticker = setInterval(tick, 100);
      render();
    }
    function pause() {
      if (!running) return;
      remaining = Math.max(0, endTime - Date.now());
      running = false;
      clearInterval(ticker); ticker = null;
      setStartLabel("Start");
      render();
    }
    function reset() {
      running = false;
      clearInterval(ticker); ticker = null;
      stopAlarm();
      remaining = baseSec * 1000;
      setStartLabel("Start");
      render();
    }
    function addTime(sec) {
      remaining += sec * 1000;
      if (running) endTime += sec * 1000;
      render();
    }

    if (startPauseBtn) startPauseBtn.addEventListener("click", () => running ? pause() : start());
    if (act("reset")) act("reset").addEventListener("click", reset);
    root.querySelectorAll("[data-act=plus]").forEach(b =>
      b.addEventListener("click", () => addTime(+b.dataset.sec || 0)));

    if (custom && inH && inM && inS) {
      [inH, inM, inS].forEach(el => el.addEventListener("input", () => {
        baseSec = readInputs();
        if (!running) { remaining = baseSec * 1000; stopAlarm(); render(); }
      }));
    }
    render();
    return;
  }

  // ===== STOPWATCH =======================================================
  if (kind === "stopwatch") {
    let elapsed = 0, startAt = 0, running = false, ticker = null;
    const lapsEl = root.querySelector("[data-laps]");
    const laps = [];

    function render() {
      display.textContent = T.fmtStop(elapsed);
      setTitle(running ? T.fmtStop(elapsed) : "");
    }
    function tick() { elapsed = Date.now() - startAt; render(); }
    function start() {
      if (running) return;
      startAt = Date.now() - elapsed;
      running = true;
      if (typeof window.gtag === "function") window.gtag("event", "tool_use", { action: "start" });
      setStartLabel("Pause");
      ticker = setInterval(tick, 39);
    }
    function pause() {
      if (!running) return;
      elapsed = Date.now() - startAt;
      running = false;
      clearInterval(ticker); ticker = null;
      setStartLabel("Start");
      render();
    }
    function reset() {
      running = false;
      clearInterval(ticker); ticker = null;
      elapsed = 0; laps.length = 0;
      setStartLabel("Start");
      renderLaps(); render();
    }
    function lap() {
      if (elapsed === 0) return;
      const prev = laps.length ? laps[laps.length - 1].total : 0;
      laps.push({ total: elapsed, split: elapsed - prev });
      renderLaps();
    }
    function renderLaps() {
      if (!lapsEl) return;
      lapsEl.innerHTML = laps.map((l, i) =>
        `<li><span class="lapn">Lap ${i + 1}</span><span class="lapsplit">${T.fmtStop(l.split)}</span><span class="laptotal">${T.fmtStop(l.total)}</span></li>`
      ).reverse().join("");
    }

    if (startPauseBtn) startPauseBtn.addEventListener("click", () => running ? pause() : start());
    if (act("reset")) act("reset").addEventListener("click", reset);
    if (act("lap")) act("lap").addEventListener("click", lap);
    render();
    return;
  }

  // ===== INTERVAL (Pomodoro + HIIT) ======================================
  if (kind === "interval") {
    const phaseEl = root.querySelector("[data-phase]");
    const cycleEl = root.querySelector("[data-cycle]");
    const workLabel = root.dataset.worklabel || "Work";
    const breakLabel = root.dataset.breaklabel || "Break";
    const longBreak = +root.dataset.longbreak || 0;

    const inWorkM = root.querySelector("[data-in=work-m]");
    const inWorkS = root.querySelector("[data-in=work-s]");
    const inBreakM = root.querySelector("[data-in=break-m]");
    const inBreakS = root.querySelector("[data-in=break-s]");
    const inRounds = root.querySelector("[data-in=rounds]");

    let cfg = {
      work: +root.dataset.work || 60,
      brk: +root.dataset.break || 30,
      rounds: +root.dataset.rounds || 4,
    };
    let phases = [], idx = 0, remaining = 0, endTime = 0, running = false, ticker = null;

    function buildPhases() {
      phases = [];
      for (let r = 1; r <= cfg.rounds; r++) {
        phases.push({ label: workLabel, sec: cfg.work, round: r, type: "work" });
        const isLast = r === cfg.rounds;
        const bsec = isLast && longBreak ? longBreak : cfg.brk;
        const blabel = isLast && longBreak ? "Long Break" : breakLabel;
        if (bsec > 0) phases.push({ label: blabel, sec: bsec, round: r, type: "break" });
      }
    }
    function readInputs() {
      cfg.work = (Math.max(0, +inWorkM.value || 0)) * 60 + Math.max(0, Math.min(59, +inWorkS.value || 0));
      cfg.brk = (Math.max(0, +inBreakM.value || 0)) * 60 + Math.max(0, Math.min(59, +inBreakS.value || 0));
      cfg.rounds = Math.max(1, Math.min(20, +inRounds.value || 1));
      if (cfg.work <= 0) cfg.work = 1;
    }
    function render() {
      const p = phases[idx];
      const secs = Math.ceil(remaining / 1000);
      display.textContent = T.fmt(secs);
      if (phaseEl) phaseEl.textContent = p ? p.label : "Done";
      if (cycleEl) cycleEl.textContent = p ? `Round ${p.round} of ${cfg.rounds}` : "Complete";
      root.classList.toggle("is-break", !!(p && p.type === "break"));
      setTitle(running && p ? T.fmt(secs) + " " + p.label : "");
    }
    function loadPhase(i) {
      idx = i;
      if (idx >= phases.length) { finish(); return; }
      remaining = phases[idx].sec * 1000;
      if (running) endTime = Date.now() + remaining;
      render();
    }
    function finish() {
      running = false;
      clearInterval(ticker); ticker = null;
      setStartLabel("Start"); setTitle("Done");
      if (phaseEl) phaseEl.textContent = "Done";
      if (cycleEl) cycleEl.textContent = "All rounds complete";
      display.textContent = "0:00";
      startAlarm();
    }
    function tick() {
      remaining = endTime - Date.now();
      if (remaining <= 0) {
        pip();
        if (idx + 1 >= phases.length) { finish(); return; }
        loadPhase(idx + 1);
        return;
      }
      render();
    }
    function start() {
      if (running) return;
      if (idx >= phases.length) reset();
      stopAlarm(); ensureAudio();
      endTime = Date.now() + remaining;
      running = true;
      if (typeof window.gtag === "function") window.gtag("event", "tool_use", { action: "start" });
      setStartLabel("Pause");
      ticker = setInterval(tick, 100);
      render();
    }
    function pause() {
      if (!running) return;
      remaining = Math.max(0, endTime - Date.now());
      running = false;
      clearInterval(ticker); ticker = null;
      setStartLabel("Start");
      render();
    }
    function reset() {
      running = false;
      clearInterval(ticker); ticker = null;
      stopAlarm();
      buildPhases();
      idx = 0;
      remaining = phases.length ? phases[0].sec * 1000 : 0;
      setStartLabel("Start");
      render();
    }
    function skip() {
      if (idx + 1 >= phases.length) { finish(); return; }
      loadPhase(idx + 1);
    }

    if (startPauseBtn) startPauseBtn.addEventListener("click", () => running ? pause() : start());
    if (act("reset")) act("reset").addEventListener("click", reset);
    if (act("skip")) act("skip").addEventListener("click", skip);
    [inWorkM, inWorkS, inBreakM, inBreakS, inRounds].forEach(el => {
      if (el) el.addEventListener("input", () => { if (!running) { readInputs(); reset(); } });
    });

    buildPhases();
    remaining = phases.length ? phases[0].sec * 1000 : 0;
    render();
    return;
  }
})();
