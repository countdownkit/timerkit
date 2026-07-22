/*
 * Shared timer formatting — used by BOTH generate.js (Node, server render of the
 * initial display) and tool.js (browser, live updates) so the starting value the
 * crawler/no-JS user sees matches what the live tool renders. UMD-ish: attaches to
 * module.exports under Node, window.TIMER in the browser.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TIMER = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  // Whole-second clock: "M:SS", "MM:SS", or "H:MM:SS" once an hour is present.
  function fmt(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : pad(m) + ":" + pad(s);
  }

  // Stopwatch clock with hundredths: "MM:SS.CS" (or "H:MM:SS.CS" past an hour).
  function fmtStop(ms) {
    ms = Math.max(0, ms);
    const cs = Math.floor(ms / 10) % 100;
    const totalS = Math.floor(ms / 1000);
    const s = totalS % 60;
    const m = Math.floor(totalS / 60) % 60;
    const h = Math.floor(totalS / 3600);
    return (h > 0 ? h + ":" + pad(m) : pad(m)) + ":" + pad(s) + "." + pad(cs);
  }

  // Human duration for titles/copy, e.g. 300 -> "5 minutes", 3600 -> "1 hour".
  function words(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (h) parts.push(h + (h === 1 ? " hour" : " hours"));
    if (m) parts.push(m + (m === 1 ? " minute" : " minutes"));
    if (s) parts.push(s + (s === 1 ? " second" : " seconds"));
    return parts.join(" ") || "0 seconds";
  }

  return { pad, fmt, fmtStop, words };
});
