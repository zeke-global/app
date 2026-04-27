/* ═══════════════════════════════════════
   ZEKE — SESSION JS
   Loaded second on every dashboard page.
   Exposes: window.ZK (user + profile)
   Fires:   'zeke:ready' on document when done
═══════════════════════════════════════ */

window.ZK = null; // { id, email, role, display_name, location, inf?, brand? }

function zekeSignOut() {
  onSupabaseReady(function () {
    zeke_sb.auth.signOut().then(function () {
      window.location.href = 'auth.html';
    });
  });
}

onSupabaseReady(function () {
  zeke_sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) { window.location.href = 'auth.html'; return; }

    var uid = session.user.id;

    zeke_sb.from('profiles')
      .select('id, role, display_name, location')
      .eq('id', uid).single()
      .then(function (r) {
        if (r.error || !r.data) { window.location.href = 'auth.html'; return; }

        var profile = r.data;

        // Role guard
        var path = window.location.pathname;
        var onCreator = path.indexOf('creator.html') !== -1;
        var onBrand   = path.indexOf('brand.html')   !== -1;
        var onAdmin   = path.indexOf('admin.html')   !== -1;
        if (onCreator && profile.role !== 'influencer') { window.location.href = 'auth.html'; return; }
        if (onBrand   && profile.role !== 'brand')      { window.location.href = 'auth.html'; return; }
        if (onAdmin   && profile.role !== 'admin')      { window.location.href = 'auth.html'; return; }

        window.ZK = { id: uid, email: session.user.email, role: profile.role, display_name: profile.display_name, location: profile.location };

        // Load role-specific extras then fire ready
        if (profile.role === 'influencer') {
          zeke_sb.from('influencer_profiles')
            .select('handle, niche, ig_followers, yt_followers, x_followers, yt_enabled, x_enabled, rating, shield_active')
            .eq('id', uid).single()
            .then(function (rr) {
              window.ZK.inf = rr.data || {};
              _fireReady();
            });
        } else if (profile.role === 'brand') {
          zeke_sb.from('brand_profiles')
            .select('brand_type')
            .eq('id', uid).single()
            .then(function (rr) {
              window.ZK.brand = rr.data || {};
              _fireReady();
            });
        } else {
          _fireReady();
        }

        // Wire all sign-out buttons
        document.querySelectorAll('.sign-out-btn').forEach(function (el) {
          el.addEventListener('click', function (e) { e.preventDefault(); zekeSignOut(); });
        });
      });
  });
});

function _fireReady() {
  document.dispatchEvent(new Event('zeke:ready'));
}

function onZekeReady(fn) {
  if (window.ZK) { fn(); return; }
  document.addEventListener('zeke:ready', fn, { once: true });
}
