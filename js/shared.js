/* ═══════════════════════════════════════
   ZEKE — SHARED JS
   Utilities used across all pages
═══════════════════════════════════════ */

// ── NOTIFICATIONS ────────────────────────────────────────
function toggleNotif() {
  var panel = document.getElementById('notif-panel');
  var overlay = document.getElementById('notif-overlay');
  if (!panel) return;
  var isOpen = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', isOpen);
  if (overlay) overlay.classList.toggle('open', !isOpen);
}

function clearNotifs() {
  document.querySelectorAll('.notif-item.unread').forEach(function(el){ el.classList.remove('unread'); });
  document.querySelectorAll('.notif-unread-dot').forEach(function(el){ el.style.display = 'none'; });
  var dot = document.getElementById('main-notif-dot');
  if (dot) dot.style.display = 'none';
  if (window.zeke_sb && window.ZK) {
    window.zeke_sb.from('notifications').update({ read: true }).eq('user_id', window.ZK.id).eq('read', false).then(function () {});
  }
}

// ── PASSWORD TOGGLE ───────────────────────────────────────
function togglePw(id, btn) {
  var input = document.getElementById(id);
  if (!input) return;
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
  else { input.type = 'password'; btn.textContent = 'Show'; }
}

// ── ERROR HELPERS ─────────────────────────────────────────
function showErr(id, msg) {
  var el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function hideErr(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ── BUTTON LOADING ────────────────────────────────────────
function setBtnLoading(btnId, loading, label) {
  var btn = document.getElementById(btnId); if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : label;
}

// ── YEAR ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
