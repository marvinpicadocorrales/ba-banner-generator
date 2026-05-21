/* ============================================================================
   BA Banner Generator v2.0 — shared.js
   clickTag + 30-second animation stop.
   Included in every banner template via <script src>.
   ============================================================================ */


/* ─── clickTag ───────────────────────────────────────────────────────────────
   Ad servers (Google, DV360, Adform, TradeDesk) populate this variable with
   the campaign landing page URL at trafficking time.
   Leave empty for development — the trafficker fills it on upload.
   ─────────────────────────────────────────────────────────────────────────── */
var clickTag = "";


/* ─── 30-second animation stop ───────────────────────────────────────────────
   IAB / Google Ad Manager require primary creative animation to stop at 30s.
   Copy fade is frozen on its last computed frame.
   CTA glow is intentionally excluded — a subtle interactive pulse on a click
   target is permitted under IAB standards and accepted by Google, DV360, and
   most DSPs as it serves a functional UI purpose (not decorative animation).
   ─────────────────────────────────────────────────────────────────────────── */
setTimeout(function () {
  var els = ['.copy-1', '.copy-2']
    .map(function (s) { return document.querySelector(s); })
    .filter(Boolean);

  // Capture computed opacity before killing animation
  var opacities = els.map(function (el) {
    return parseFloat(window.getComputedStyle(el).opacity);
  });

  // Freeze each element on its current frame
  els.forEach(function (el) {
    var s = window.getComputedStyle(el);
    el.style.opacity   = s.opacity;
    el.style.transform = s.transform;
    el.style.animation = 'none';
  });

  // After browser registers animation:none, transition winner to full opacity
  var winnerIdx = opacities[0] >= opacities[1] ? 0 : 1;
  setTimeout(function () {
    els.forEach(function (el, i) {
      el.style.transition = 'opacity 0.5s ease';
      el.style.opacity    = i === winnerIdx ? '1' : '0';
    });
  }, 50);

  // Stop background video — pauses on last frame (acts as a still)
  // IAB / Google DV360: looping video counts as animation, must stop at 30s
  var video = document.querySelector('.video-bg video');
  if (video) { video.pause(); }
}, 30000);
