/* ═══════════════════════════════════════
   ZEKE — AUTH JS
   Requires supabase.js loaded first.
═══════════════════════════════════════ */

var isAdult = null;
var regRole = 'influencer';

// ── VIEW TOGGLE ───────────────────────────────────────────
function showView(v) {
  var login = document.getElementById('login-view');
  var reg   = document.getElementById('register-view');
  if (login) login.classList.toggle('hidden', v !== 'login');
  if (reg)   reg.classList.toggle('hidden',   v !== 'register');
  if (v === 'register') { goStep1(); setRole('influencer'); }
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

  var userId = null;

  onSupabaseReady(function () {
    zeke_sb.auth.signUp({ email: email, password: pass })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        userId = res.data.user.id;
        return zeke_sb.from('profiles').insert({
          id: userId, role: regRole, display_name: name,
          location: regRole === 'brand'
            ? document.getElementById('brand-location').value.trim()
            : document.getElementById('inf-location').value.trim()
        });
      })
      .then(function (r) {
        if (r.error) throw new Error(r.error.message);
        if (regRole === 'brand') {
          var bt = document.querySelector('input[name="btype"]:checked');
          return zeke_sb.from('brand_profiles').insert({ id: userId, brand_type: bt ? bt.value : 'business' });
        } else {
          var ytH = document.getElementById('inf-yt-handle') ? document.getElementById('inf-yt-handle').value.trim() : '';
          var ytF = document.getElementById('inf-yt-followers') ? parseInt(document.getElementById('inf-yt-followers').value, 10) : 0;
          var xH  = document.getElementById('inf-x-handle')  ? document.getElementById('inf-x-handle').value.trim()  : '';
          var xF  = document.getElementById('inf-x-followers') ? parseInt(document.getElementById('inf-x-followers').value, 10) : 0;
          var ytOn = document.getElementById('inf-yt-toggle') ? document.getElementById('inf-yt-toggle').checked : false;
          var xOn  = document.getElementById('inf-x-toggle')  ? document.getElementById('inf-x-toggle').checked  : false;
          return zeke_sb.from('influencer_profiles').insert({
            id: userId,
            niche: document.getElementById('inf-niche').value,
            handle: document.getElementById('inf-ig-handle').value.trim(),
            ig_followers: parseInt(document.getElementById('inf-ig-followers').value, 10) || 0,
            yt_followers: (ytOn && ytF > 0) ? ytF : null,
            x_followers:  (xOn  && xF  > 0) ? xF  : null,
            yt_enabled: ytOn,
            x_enabled:  xOn,
            is_adult: isAdult !== false
          });
        }
      })
      .then(function (r) {
        if (r.error) throw new Error(r.error.message);
        if (regRole === 'influencer' && isAdult === false) {
          return zeke_sb.from('guardians').insert({
            influencer_id: userId,
            guardian_name:  document.getElementById('guardian-name').value.trim(),
            guardian_email: document.getElementById('guardian-email').value.trim(),
            relation:       document.getElementById('guardian-relation').value
          });
        }
      })
      .then(function (r) {
        if (r && r.error) throw new Error(r.error.message);
        if (regRole === 'brand') window.location.href = 'brand.html';
        else                     window.location.href = 'creator.html';
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
