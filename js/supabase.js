/* ═══════════════════════════════════════════════════════════
   ZEKE — SUPABASE CLIENT
   js/supabase.js
   Import this FIRST before shared.js / auth.js / creator.js etc.

   HOW TO USE:
   1. Go to your Supabase project → Settings → API
   2. Copy "Project URL" and "anon public" key
   3. Paste below replacing the placeholder strings
   4. Add this script tag FIRST in every HTML page:
      <script src="js/supabase.js"></script>
═══════════════════════════════════════════════════════════ */

var SUPABASE_URL = 'https://fslthsbjtgmdbabwcubs.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbHRoc2JqdGdtZGJhYndjdWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTA5MTIsImV4cCI6MjA5Mjg2NjkxMn0.dGcEueAx6K5dqQf__jh96XDHA2rtDE7jmCQanSpWx24';

// Load Supabase SDK from CDN then expose window.zeke_sb
(function () {
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = function () {
    window.zeke_sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    document.dispatchEvent(new Event('zeke:supabase:ready'));
  };
  document.head.appendChild(script);
})();

// Helper — wait for client to be ready then run callback
function onSupabaseReady(fn) {
  if (window.zeke_sb) { fn(); return; }
  document.addEventListener('zeke:supabase:ready', fn, { once: true });
}
