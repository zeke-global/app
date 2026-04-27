/* ═══════════════════════════════════════
   ZEKE — AUTH JS
   Requires supabase.js loaded first.
═══════════════════════════════════════ */

var isAdult = null;
var regRole = 'influencer';

// Capture this BEFORE Supabase consumes the URL hash.
var ZEKE_RECOVERY_FLOW = window.location.hash.indexOf('type=recovery') !== -1;

// ── VIEW TOGGLE ───────────────────────────────────────────
function showView(v) {
  ['login','register','verify','reset','newpw'].forEach(function (key) {
    var el = document.getElementById(key + '-view');
    if (el) el.classList.toggle('hidden', v !== key);
  });
  if (v === 'register') { goStep1(); setRole('influencer'); }
  if (v === 'reset') { hideErr('reset-error'); var s = document.getElementById('reset-success'); if (s) s.classList.add('hidden'); }
}

// ── BOOT ──────────────────────────────────────────────────
onSupabaseReady(function () {
  // Always listen for password-recovery — fires when Supabase finishes parsing the URL hash.
  zeke_sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') showView('newpw');
  });

  // If the URL itself indicates recovery, switch view immediately (don't redirect to a dashboard).
  if (ZEKE_RECOVERY_FLOW) { showView('newpw'); return; }

  // Otherwise: if a session already exists, route to the appropriate dashboard.
  zeke_sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) return;
    zeke_sb.from('profiles').select('role').eq('id', session.user.id).single()
      .then(function (r) {
        if (!r.data) return;
        if (r.data.role === 'admin')      window.location.href = 'admin.html';
        else if (r.data.role === 'brand') window.location.href = 'brand.html';
        else                              window.location.href = 'creator.html';
      });
  });
});

// ── PASSWORD RESET ────────────────────────────────────────
function requestReset() {
  var email = document.getElementById('reset-email').value.trim();
  if (!email || email.indexOf('@') < 0) { showErr('reset-error', 'Enter a valid email.'); return; }
  hideErr('reset-error');
  setBtnLoading('reset-btn', true, 'Send Reset Link');
  onSupabaseReady(function () {
    zeke_sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, 'auth.html')
    }).then(function (res) {
      setBtnLoading('reset-btn', false, 'Send Reset Link');
      if (res.error) { showErr('reset-error', res.error.message); return; }
      var s = document.getElementById('reset-success'); if (s) s.classList.remove('hidden');
    });
  });
}

function submitNewPassword() {
  var pw  = document.getElementById('newpw-password').value;
  var pw2 = document.getElementById('newpw-confirm').value;
  if (!pw || pw.length < 8) { showErr('newpw-error', 'Password must be at least 8 characters.'); return; }
  if (pw !== pw2)            { showErr('newpw-error', 'Passwords do not match.'); return; }
  hideErr('newpw-error');
  setBtnLoading('newpw-btn', true, 'Update Password');
  onSupabaseReady(function () {
    zeke_sb.auth.updateUser({ password: pw }).then(function (res) {
      setBtnLoading('newpw-btn', false, 'Update Password');
      if (res.error) { showErr('newpw-error', res.error.message); return; }
      // Clean URL hash and route to the appropriate dashboard.
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      zeke_sb.from('profiles').select('role').eq('id', res.data.user.id).single()
        .then(function (r) {
          var role = r && r.data ? r.data.role : 'influencer';
          if (role === 'admin')      window.location.href = 'admin.html';
          else if (role === 'brand') window.location.href = 'brand.html';
          else                       window.location.href = 'creator.html';
        });
    });
  });
}

// ── LOGIN ─────────────────────────────────────────────────
function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-password').value;
  if (!email || email.indexOf('@') < 0) { showErr('login-error', 'Enter a valid email.'); return; }
  if (!pass || pass.length < 8)         { showErr('login-error', 'Password must be at least 8 characters.'); return; }
  hideErr('login-error');
  setBtnLoading('login-btn', true, 'Sign In');

  onSupabaseReady(function () {
    zeke_sb.auth.signInWithPassword({ email: email, password: pass })
      .then(function (res) {
        if (res.error) { setBtnLoading('login-btn', false, 'Sign In'); showErr('login-error', 'Invalid email or password.'); return null; }
        return zeke_sb.from('profiles').select('role').eq('id', res.data.user.id).single();
      })
      .then(function (res) {
        if (!res) return;
        if (res.error) { setBtnLoading('login-btn', false, 'Sign In'); showErr('login-error', 'Account not set up. Contact support.'); return; }
        var role = res.data.role;
        if (role === 'admin')      window.location.href = 'admin.html';
        else if (role === 'brand') window.location.href = 'brand.html';
        else                       window.location.href = 'creator.html';
      })
      .catch(function () { setBtnLoading('login-btn', false, 'Sign In'); showErr('login-error', 'Something went wrong. Try again.'); });
  });
}

// ── REGISTER ROLE ─────────────────────────────────────────
function setRole(role) {
  regRole = role;
  isAdult = null;
  var cb = document.getElementById('role-creator-btn');
  var bb = document.getElementById('role-brand-btn');
  var nl = document.getElementById('name-label');
  if (cb) cb.className = 'role-btn' + (role === 'influencer' ? ' active' : '');
  if (bb) bb.className = 'role-btn' + (role === 'brand'      ? ' active' : '');
  if (nl) nl.textContent = role === 'influencer' ? 'Full Name' : 'Brand / Company Name';
  goStep1();
  ['reg-name','reg-email','reg-password'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
}

// ── STEP NAVIGATION ───────────────────────────────────────
function goStep2() {
  var name  = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass  = document.getElementById('reg-password').value;
  if (!name)                            { showErr('step1-error', 'Enter your name.'); return; }
  if (!email || email.indexOf('@') < 0) { showErr('step1-error', 'Enter a valid email.'); return; }
  if (!pass || pass.length < 8)         { showErr('step1-error', 'Password must be at least 8 characters.'); return; }
  hideErr('step1-error');
  document.getElementById('reg-step1').classList.add('hidden');
  document.getElementById('reg-step2').classList.remove('hidden');
  document.getElementById('brand-fields').classList.toggle('hidden',  regRole !== 'brand');
  document.getElementById('influencer-fields').classList.toggle('hidden', regRole !== 'influencer');
}

function goStep1() {
  var s1 = document.getElementById('reg-step1');
  var s2 = document.getElementById('reg-step2');
  if (s1) s1.classList.remove('hidden');
  if (s2) s2.classList.add('hidden');
  hideErr('step1-error');
  hideErr('step2-error');
}

// ── AGE CHECK ─────────────────────────────────────────────
function setAge(adult) {
  isAdult = adult;
  var yBtn = document.getElementById('age-yes-btn');
  var nBtn = document.getElementById('age-no-btn');
  var gf   = document.getElementById('guardian-fields');
  var onStyle  = ';border:1px solid rgba(5,150,105,.4);border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;color:#059669;background:rgba(5,150,105,.08)';
  var offStyle = ';border:1px solid #252A45;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;color:#7B84A3;background:transparent';
  var baseStyle = 'flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px';
  if (adult) {
    yBtn.style.cssText = baseStyle + onStyle;
    nBtn.style.cssText = baseStyle + offStyle;
    if (gf) gf.classList.add('hidden');
  } else {
    nBtn.style.cssText = baseStyle.replace('059669','D97706') + ';border:1px solid rgba(217,119,6,.4);border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;color:#D97706;background:rgba(217,119,6,.08)';
    yBtn.style.cssText = baseStyle + offStyle;
    if (gf) gf.classList.remove('hidden');
  }
}

// ── REGISTER ──────────────────────────────────────────────
function doRegister() {
  var err  = 'step2-error';
  var name  = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass  = document.getElementById('reg-password').value;

  if (regRole === 'brand') {
    var loc = document.getElementById('brand-location').value.trim();
    if (!loc) { showErr(err, 'Enter your location.'); return; }
  } else {
    var niche = document.getElementById('inf-niche').value;
    var loc2  = document.getElementById('inf-location').value.trim();
    var igH   = document.getElementById('inf-ig-handle').value.trim();
    var igF   = parseInt(document.getElementById('inf-ig-followers').value, 10);
    if (!niche)        { showErr(err, 'Select your niche.'); return; }
    if (!loc2)         { showErr(err, 'Enter your location.'); return; }
    if (!igH)          { showErr(err, 'Enter your Instagram handle.'); return; }
    if (!igF || igF < 1) { showErr(err, 'Enter your Instagram follower count.'); return; }
    if (isAdult === null) { showErr(err, 'Confirm your age.'); return; }
    if (!isAdult) {
      var gName  = document.getElementById('guardian-name').value.trim();
      var gEmail = document.getElementById('guardian-email').value.trim();
      var gRel   = document.getElementById('guardian-relation').value;
      if (!gName)                   { showErr(err, "Enter guardian's name."); return; }
      if (!gEmail || gEmail.indexOf('@') < 0) { showErr(err, 'Enter a valid guardian email.'); return; }
      if (!gRel)                    { showErr(err, 'Select guardian relationship.'); return; }
    }
  }

  hideErr(err);
  setBtnLoading('register-btn', true, 'Create Account');

  // Build metadata for the DB trigger (handle_new_user) to consume.
  var meta = { role: regRole, display_name: name };

  if (regRole === 'brand') {
    var bt = document.querySelector('input[name="btype"]:checked');
    meta.brand_type = bt ? bt.value : 'business';
    meta.location   = document.getElementById('brand-location').value.trim();
  } else {
    var ytOn = document.getElementById('inf-yt-toggle') ? document.getElementById('inf-yt-toggle').checked : false;
    var xOn  = document.getElementById('inf-x-toggle')  ? document.getElementById('inf-x-toggle').checked  : false;
    meta.location     = document.getElementById('inf-location').value.trim();
    meta.niche        = document.getElementById('inf-niche').value;
    meta.handle       = document.getElementById('inf-ig-handle').value.trim().replace('@','');
    meta.ig_followers = parseInt(document.getElementById('inf-ig-followers').value, 10) || 0;
    meta.yt_enabled   = ytOn;
    meta.x_enabled    = xOn;
    if (ytOn) {
      meta.yt_handle    = document.getElementById('inf-yt-handle').value.trim();
      meta.yt_followers = parseInt(document.getElementById('inf-yt-followers').value, 10) || 0;
    }
    if (xOn) {
      meta.x_handle    = document.getElementById('inf-x-handle').value.trim();
      meta.x_followers = parseInt(document.getElementById('inf-x-followers').value, 10) || 0;
    }
    meta.is_adult = isAdult !== false;
    if (!meta.is_adult) {
      meta.guardian_name     = document.getElementById('guardian-name').value.trim();
      meta.guardian_email    = document.getElementById('guardian-email').value.trim();
      meta.guardian_relation = document.getElementById('guardian-relation').value;
    }
  }

  onSupabaseReady(function () {
    zeke_sb.auth.signUp({
      email: email,
      password: pass,
      options: {
        data: meta,
        emailRedirectTo: window.location.origin + '/auth.html'
      }
    })
      .then(function (res) {
        if (res.error) {
          setBtnLoading('register-btn', false, 'Create Account');
          showErr(err, res.error.message);
          return;
        }
        // If email confirmation is OFF in Supabase, the user is already signed in
        // and gets a session. Otherwise session is null and they must verify by email.
        if (res.data && res.data.session) {
          if (regRole === 'brand') window.location.href = 'brand.html';
          else                     window.location.href = 'creator.html';
        } else {
          var target = document.getElementById('verify-email-target');
          if (target) target.textContent = 'We sent a verification link to ' + email + '.';
          showView('verify');
        }
      })
      .catch(function (e) {
        setBtnLoading('register-btn', false, 'Create Account');
        showErr(err, e.message || 'Registration failed. Try again.');
      });
  });
}

function selectBrandType(input) {
  ['opt-business','opt-ngo','opt-agency'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.className = 'radio-option';
  });
  input.parentElement.className = 'radio-option selected';
}

function setBtnLoading(btnId, loading, label) {
  var btn = document.getElementById(btnId); if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : label;
}
