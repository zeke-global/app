/* ═══════════════════════════════════════
   ZEKE — CREATOR JS
   Requires session.js → window.ZK ready
═══════════════════════════════════════ */

var _activeTab  = 'overview';
var _activeDeal = null;
var _activeChat = null;
var _chatChannel = null;

// ── TABS ──────────────────────────────────────────────────
function switchTab(tab) {
  ['overview','offers','chats','deals','agreements','profile'].forEach(function (t) {
    var el  = document.getElementById('tab-' + t);     if (el)  el.classList.toggle('hidden', t !== tab);
    var btn = document.getElementById('inf-tab-' + t); if (btn) btn.className = 'sidebar-nav-btn' + (t === tab ? ' active-tab' : '');
  });
  _activeTab = tab;
  if (tab !== 'deals') closeDeal();
  if (tab !== 'chats') closeChat();
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '#' + tab);
  }
  if (tab === 'overview')   loadOverview();
  if (tab === 'offers')     loadOffers();
  if (tab === 'chats')      loadChats();
  if (tab === 'deals')      loadDeals();
  if (tab === 'agreements') loadAgreements();
  if (tab === 'profile')    loadProfile();
}

function setMob(tab) {
  ['overview','offers','chats','deals','profile'].forEach(function (t) {
    var b = document.getElementById('mob-' + t); if (b) b.className = 'mob-nav-btn' + (t === tab ? ' active' : '');
  });
}

// ── OVERVIEW ─────────────────────────────────────────────
function loadOverview() {
  var inf = ZK.inf || {};
  var initials = ZK.display_name ? ZK.display_name.slice(0,2).toUpperCase() : '--';

  // Sidebar
  _set('sidebar-creator-avatar', initials);
  _set('sidebar-creator-name',   ZK.display_name || '--');
  _set('sidebar-creator-handle', inf.handle ? '@' + inf.handle.replace('@','') : inf.niche || '--');

  // Greeting
  _set('overview-name', 'Hey, ' + (ZK.display_name || 'Creator'));
  _set('overview-sub',  [inf.niche, ZK.location].filter(Boolean).join(' · '));

  // Nav badge
  var badge = document.getElementById('nav-shield-badge');
  if (badge) badge.textContent = inf.shield_active ? '🛡 Shield' : 'Free Creator';

  // Platform stats
  _set('stat-ig', inf.ig_followers ? fmtNum(inf.ig_followers) : '--');
  _set('stat-yt', (inf.yt_enabled && inf.yt_followers) ? fmtNum(inf.yt_followers) : '--');
  _set('stat-x',  (inf.x_enabled  && inf.x_followers)  ? fmtNum(inf.x_followers)  : '--');

  // Hide/show optional platforms
  var ytRow = document.getElementById('platform-row-yt');
  var xRow  = document.getElementById('platform-row-x');
  if (ytRow) ytRow.style.display = inf.yt_enabled ? 'flex' : 'none';
  if (xRow)  xRow.style.display  = inf.x_enabled  ? 'flex' : 'none';

  // Deals + earnings
  zeke_sb.from('deals').select('id,amount,status').eq('influencer_id', ZK.id).eq('status','completed')
    .then(function (r) {
      var rows = r.data || [];
      var total = rows.reduce(function (s,d) { return s + (d.amount||0); }, 0);
      _set('stat-deals',  rows.length);
      _set('stat-earned', '₹' + fmtNum(total));
    });

  // Pending offers
  zeke_sb.from('deals').select('id', { count:'exact', head:true }).eq('influencer_id', ZK.id).eq('status','negotiating')
    .then(function (r) { _set('stat-offers', r.count || 0); });

  _set('stat-rating', inf.rating ? inf.rating + '/5' : '--');

  // Recent deal preview
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,profiles!deals_brand_id_fkey(display_name)')
    .eq('influencer_id', ZK.id).order('updated_at',{ascending:false}).limit(1)
    .then(function (r) {
      var c = document.getElementById('overview-recent-deal'); if (!c) return;
      if (!r.data || !r.data.length) { c.innerHTML = '<div class="empty-state" style="padding:20px">No deals yet.</div>'; return; }
      c.innerHTML = _dealCard(r.data[0]);
    });

  loadNotifications();
}

// ── PROFILE TAB ───────────────────────────────────────────
function loadProfile() {
  var inf = ZK.inf || {};
  var initials = ZK.display_name ? ZK.display_name.slice(0,2).toUpperCase() : '--';
  _set('profile-avatar', initials);
  _set('profile-name',   ZK.display_name || '--');
  _set('profile-handle', [(inf.handle ? '@'+inf.handle.replace('@','') : ''), ZK.location].filter(Boolean).join(' · '));
  _set('profile-niche',  inf.niche || '');
  _set('profile-shield-label', inf.shield_active ? '🛡 Shield Member' : 'Free Creator');

  // Follower counts in profile
  _set('profile-ig-count', inf.ig_followers ? fmtNum(inf.ig_followers) : '--');
  _set('profile-yt-count', (inf.yt_enabled && inf.yt_followers) ? fmtNum(inf.yt_followers) : '--');
  _set('profile-x-count',  (inf.x_enabled  && inf.x_followers)  ? fmtNum(inf.x_followers)  : '--');

  var ytRow = document.getElementById('profile-yt-row');
  var xRow  = document.getElementById('profile-x-row');
  if (ytRow) ytRow.style.display = inf.yt_enabled ? 'flex' : 'none';
  if (xRow)  xRow.style.display  = inf.x_enabled  ? 'flex' : 'none';

  // Pre-fill edit form
  _val('edit-ig-handle',    inf.handle || '');
  _val('edit-ig-followers', inf.ig_followers || '');
  _val('edit-yt-handle',    inf.yt_handle || '');
  _val('edit-yt-followers', inf.yt_followers || '');
  _val('edit-x-handle',     inf.x_handle || '');
  _val('edit-x-followers',  inf.x_followers || '');
  var ytToggle = document.getElementById('edit-yt-toggle');
  var xToggle  = document.getElementById('edit-x-toggle');
  if (ytToggle) { ytToggle.checked = !!inf.yt_enabled; togglePlatformEdit('yt'); }
  if (xToggle)  { xToggle.checked  = !!inf.x_enabled;  togglePlatformEdit('x'); }

  // Deal history in profile
  zeke_sb.from('deals')
    .select('id,title,amount,status,profiles!deals_brand_id_fkey(display_name)')
    .eq('influencer_id', ZK.id).order('updated_at',{ascending:false}).limit(3)
    .then(function (r) {
      var c = document.getElementById('profile-deal-history'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div style="font-size:12px;color:#7B84A3">No deals yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) {
        var brand = (d.profiles && d.profiles.display_name) || 'Brand';
        var si = _si(d.status);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #252A45">'
          + '<div><div style="font-size:12px;font-weight:600;color:#fff">' + esc(brand) + '</div>'
          + '<div style="font-size:11px;color:#7B84A3">' + esc(d.title||'') + '</div></div>'
          + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:' + si.color + '">₹' + fmtNum(d.amount||0) + '</div>'
          + '<div style="font-size:10px;color:#7B84A3">' + si.label + '</div></div></div>';
      }).join('');
    });
}

// Platform edit toggle
function togglePlatformEdit(platform) {
  var toggle = document.getElementById('edit-' + platform + '-toggle');
  var fields = document.getElementById('edit-' + platform + '-fields');
  if (!toggle || !fields) return;
  fields.style.display = toggle.checked ? 'flex' : 'none';
}

function saveProfile() {
  var igH = document.getElementById('edit-ig-handle')    ? document.getElementById('edit-ig-handle').value.trim()    : '';
  var igF = document.getElementById('edit-ig-followers') ? parseInt(document.getElementById('edit-ig-followers').value,10) : 0;
  if (!igH)     { showErr('profile-save-error', 'Instagram handle is required.'); return; }
  if (!igF || igF < 1) { showErr('profile-save-error', 'Instagram follower count is required.'); return; }
  hideErr('profile-save-error');

  var ytToggle = document.getElementById('edit-yt-toggle');
  var xToggle  = document.getElementById('edit-x-toggle');
  var ytOn = ytToggle ? ytToggle.checked : false;
  var xOn  = xToggle  ? xToggle.checked  : false;
  var ytF  = parseInt((document.getElementById('edit-yt-followers') || {}).value||'0', 10);
  var xF   = parseInt((document.getElementById('edit-x-followers')  || {}).value||'0', 10);
  var ytH  = (document.getElementById('edit-yt-handle') || {}).value || '';
  var xH   = (document.getElementById('edit-x-handle')  || {}).value || '';

  setBtnLoading('profile-save-btn', true, 'Save');

  zeke_sb.from('influencer_profiles').update({
    handle: igH.replace('@',''),
    ig_followers: igF,
    yt_enabled: ytOn,
    yt_followers: ytOn ? ytF : null,
    yt_handle: ytOn ? ytH : null,
    x_enabled: xOn,
    x_followers: xOn ? xF : null,
    x_handle: xOn ? xH : null
  }).eq('id', ZK.id)
    .then(function (r) {
      setBtnLoading('profile-save-btn', false, 'Save Changes');
      if (r.error) { showErr('profile-save-error', r.error.message); return; }
      // Refresh local ZK.inf
      zeke_sb.from('influencer_profiles').select('*').eq('id', ZK.id).single()
        .then(function (rr) {
          if (rr.data) { ZK.inf = rr.data; loadOverview(); loadProfile(); }
        });
    });
}

// ── OFFERS ────────────────────────────────────────────────
function loadOffers() {
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,created_at,profiles!deals_brand_id_fkey(display_name)')
    .eq('influencer_id', ZK.id).eq('status','negotiating')
    .order('created_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('offers-list'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) {
        c.innerHTML = '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>No new offers right now.</span></div>';
        return;
      }
      c.innerHTML = rows.map(function (d) {
        var brand = (d.profiles && d.profiles.display_name) || 'Brand';
        var initials = brand.slice(0,2).toUpperCase();
        return '<div class="item-card" style="margin-bottom:12px">'
          + '<div class="item-card-header">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div class="item-avatar">' + initials + '</div>'
          + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(brand) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + esc(d.platform||'') + '</div></div></div>'
          + '<div style="font-size:14px;font-weight:900;color:#D97706">₹' + fmtNum(d.amount||0) + '</div></div>'
          + '<div class="item-actions">'
          + '<button class="btn-approve" style="flex:1" onclick="acceptOffer(\'' + d.id + '\')">&#10003; Accept</button>'
          + '<button class="btn btn-primary btn-sm" onclick="switchTab(\'chats\');setMob(\'chats\');openChat(\'' + d.id + '\')">Negotiate</button>'
          + '<button class="btn btn-outline btn-sm" onclick="declineOffer(\'' + d.id + '\')">Decline</button>'
          + '</div></div>';
      }).join('');
    });
}

function acceptOffer(dealId) {
  if (!confirm('Accept this offer? Terms will be locked once accepted.')) return;
  var inf = ZK.inf || {};
  var isShield = !!inf.shield_active;

  zeke_sb.from('deals').select('*').eq('id', dealId).single()
    .then(function (r) {
      if (r.error || !r.data) { alert('Could not load deal.'); return null; }
      var d = r.data;
      return Promise.all([
        zeke_sb.from('deals').update({ status:'active', updated_at: new Date().toISOString() }).eq('id', dealId),
        zeke_sb.from('agreements').insert({ deal_id: dealId, signed_brand: true, signed_creator: true }),
        zeke_sb.from('deal_messages').insert({
          deal_id: dealId, sender_id: ZK.id,
          msg_type: isShield ? 'event_gold' : 'event',
          content: (isShield ? '🛡 ' : '✓ ') + 'Offer accepted by ' + ZK.display_name + ' · Deal active' + (isShield ? ' · Shield agreement generated' : '')
        }),
        zeke_sb.from('notifications').insert({
          user_id: d.brand_id,
          title: 'Offer accepted',
          body: ZK.display_name + ' accepted your offer · ' + d.title,
          type: 'deal'
        })
      ]);
    })
    .then(function (results) {
      if (!results) return;
      loadOffers(); loadDeals(); loadOverview(); loadAgreements();
      switchTab('deals'); setMob('deals');
      openDeal(dealId);
    });
}

function declineOffer(dealId) {
  if (!confirm('Decline this offer?')) return;
  zeke_sb.from('deals').update({ status:'cancelled' }).eq('id', dealId)
    .then(function (r) {
      if (r && r.error) { alert(r.error.message); return; }
      return zeke_sb.from('deals').select('brand_id,title').eq('id', dealId).single();
    })
    .then(function (r) {
      if (!r || !r.data) { loadOffers(); return; }
      Promise.all([
        zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '✗ Offer declined by ' + ZK.display_name }),
        zeke_sb.from('notifications').insert({ user_id: r.data.brand_id, title: 'Offer declined', body: ZK.display_name + ' declined your offer · ' + r.data.title, type: 'deal' })
      ]).then(function () { loadOffers(); });
    });
}

// ── CHATS ─────────────────────────────────────────────────
function loadChats() {
  zeke_sb.from('deals')
    .select('id,title,status,updated_at,profiles!deals_brand_id_fkey(display_name)')
    .eq('influencer_id', ZK.id).not('status','eq','cancelled')
    .order('updated_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('chats-list-inner'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No chats yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) {
        var brand = (d.profiles && d.profiles.display_name) || 'Brand';
        var si = _si(d.status);
        return '<div class="item-card" style="cursor:pointer;margin-bottom:8px" onclick="openChat(\'' + d.id + '\')">'
          + '<div style="display:flex;align-items:center;gap:14px">'
          + '<div class="item-avatar" style="color:' + si.color + '">' + brand.slice(0,2).toUpperCase() + '</div>'
          + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff">' + esc(brand) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.title||'') + '</div></div>'
          + '<span class="badge ' + si.badge + '">' + si.label + '</span>'
          + '</div></div>';
      }).join('');
    });
}

function openChat(dealId) {
  _activeChat = dealId;
  document.getElementById('chats-list').classList.add('hidden');
  var win = document.getElementById('chats-window');
  win.classList.remove('hidden'); win.style.display = 'flex';

  zeke_sb.from('deals').select('*,profiles!deals_brand_id_fkey(display_name)').eq('id', dealId).single()
    .then(function (r) {
      if (r.error || !r.data) return;
      var d = r.data;
      var brand = (d.profiles && d.profiles.display_name) || 'Brand';
      _set('chat-brand-name', brand);
      _set('chat-brand-sub', d.title + ' · ₹' + fmtNum(d.amount||0));
      _loadChatMessages(dealId);
      _subscribeChat(dealId);
    });
  window.scrollTo(0,0);
}

function closeChat() {
  _activeChat = null;
  if (_chatChannel) { zeke_sb.removeChannel(_chatChannel); _chatChannel = null; }
  var win  = document.getElementById('chats-window');
  var list = document.getElementById('chats-list');
  if (win)  { win.classList.add('hidden'); win.style.display = 'none'; }
  if (list) list.classList.remove('hidden');
}

function _loadChatMessages(dealId) {
  zeke_sb.from('deal_messages').select('*').eq('deal_id', dealId).order('created_at',{ascending:true})
    .then(function (r) { _renderChatMsgs(r.data || []); });
}

function _subscribeChat(dealId) {
  if (_chatChannel) zeke_sb.removeChannel(_chatChannel);
  _chatChannel = zeke_sb.channel('chat:' + dealId)
    .on('postgres_changes',{ event:'INSERT', schema:'public', table:'deal_messages', filter:'deal_id=eq.'+dealId },
      function (p) { if (p.new.sender_id !== ZK.id) _appendMsg(p.new); })
    .subscribe();
}

function _renderChatMsgs(msgs) {
  var c = document.getElementById('chat-messages'); if (!c) return;
  c.innerHTML = '';
  msgs.forEach(function (m) { _appendMsg(m); });
  setTimeout(function () { c.scrollTop = c.scrollHeight; }, 50);
}

function _appendMsg(m) {
  var c = document.getElementById('chat-messages'); if (!c) return;
  var div = document.createElement('div');
  var isMe = m.sender_id === ZK.id;
  if (m.msg_type === 'event') {
    div.style.cssText = 'display:flex;justify-content:center';
    div.innerHTML = '<div class="chat-event">' + esc(m.content) + '</div>';
  } else if (m.msg_type === 'event_gold') {
    div.style.cssText = 'display:flex;justify-content:center';
    div.innerHTML = '<div class="chat-event-gold">' + esc(m.content) + '</div>';
  } else if (isMe) {
    div.style.cssText = 'display:flex;justify-content:flex-end';
    div.innerHTML = '<div class="chat-bubble-out"><div style="font-size:13px;color:#C8D0E7">' + esc(m.content) + '</div><div style="font-size:10px;color:#7B84A3;margin-top:4px">You · ' + fmtDate(m.created_at) + '</div></div>';
  } else {
    div.style.cssText = 'display:flex;justify-content:flex-start';
    div.innerHTML = '<div class="chat-bubble-in"><div style="font-size:13px;color:#C8D0E7">' + esc(m.content) + '</div><div style="font-size:10px;color:#7B84A3;margin-top:4px">' + fmtDate(m.created_at) + '</div></div>';
  }
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function sendChatMessage() {
  if (!_activeChat) return;
  var input = document.getElementById('chat-input'); if (!input) return;
  var text = input.value.trim(); if (!text) return;
  input.value = '';
  var optimistic = { sender_id: ZK.id, msg_type:'text', content: text, created_at: new Date().toISOString() };
  _appendMsg(optimistic);
  zeke_sb.from('deal_messages').insert({ deal_id: _activeChat, sender_id: ZK.id, msg_type:'text', content: text })
    .then(function (r) { if (r && r.error) console.error('chat send failed:', r.error.message); });
}

// ── DEALS LIST ────────────────────────────────────────────
function loadDeals() {
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,updated_at,profiles!deals_brand_id_fkey(display_name)')
    .eq('influencer_id', ZK.id).not('status','in','("negotiating","cancelled")')
    .order('updated_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('deals-list-inner'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No active deals yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) { return _dealCard(d); }).join('');
    });
}

function _dealCard(d) {
  var brand = (d.profiles && d.profiles.display_name) || 'Brand';
  var si = _si(d.status);
  return '<div class="item-card" style="border-color:' + si.border + ';background:' + si.bg + ';cursor:pointer;margin-bottom:12px" onclick="openDeal(\'' + d.id + '\')">'
    + '<div class="item-card-header">'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div class="item-avatar" style="color:' + si.color + '">' + brand.slice(0,2).toUpperCase() + '</div>'
    + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(brand) + '</div>'
    + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + esc(d.platform||'') + '</div></div></div>'
    + '<div style="text-align:right"><div style="font-size:14px;font-weight:900;color:' + si.color + '">₹' + fmtNum(d.amount||0) + '</div>'
    + '<span class="badge ' + si.badge + '" style="margin-top:4px">' + si.label + '</span></div></div>'
    + '<div style="font-size:12px;color:#E94560;font-weight:600;text-align:right">View deal →</div>'
    + '</div>';
}

// ── DEAL DETAIL ───────────────────────────────────────────
function openDeal(dealId) {
  _activeDeal = dealId;
  switchTab('deals');
  document.getElementById('deals-list').classList.add('hidden');
  document.getElementById('deals-detail').classList.remove('hidden');

  zeke_sb.from('deals').select('*,profiles!deals_brand_id_fkey(display_name)').eq('id', dealId).single()
    .then(function (r) {
      if (r.error || !r.data) return;
      var d = r.data;
      var brand = (d.profiles && d.profiles.display_name) || 'Brand';
      var si = _si(d.status);
      var pct = { negotiating:10,active:30,submitted:55,approved:70,link_submitted:80,payment_sent:90,completed:100 }[d.status] || 30;

      _set('deal-brand-name', brand);
      _set('deal-brand-sub',  d.title + ' · ₹' + fmtNum(d.amount||0));
      var badge = document.getElementById('deal-status-badge');
      badge.textContent = si.label; badge.className = 'badge ' + si.badge;
      var fill = document.getElementById('deal-progress-fill');
      fill.style.width = pct + '%'; fill.style.background = si.color;
      _set('deal-progress-label', si.label);
      document.getElementById('deal-progress-label').style.color = si.color;

      _loadTimeline(dealId);
      _renderDeliverables(d);
      _loadSubmissions(d);
      _loadFinalLink(d);
      _loadPayment(d);
      _renderCancel(d);
      switchDealTab('overview');
      window.scrollTo(0,0);
    });
}

function closeDeal() {
  _activeDeal = null;
  var d = document.getElementById('deals-detail');
  var l = document.getElementById('deals-list');
  if (d) d.classList.add('hidden');
  if (l) l.classList.remove('hidden');
}

function switchDealTab(key) {
  ['overview','submissions','finallink','payment','cancel'].forEach(function (p) {
    var el  = document.getElementById('dpanel-' + p); if (el)  el.classList.toggle('hidden', p !== key);
    var btn = document.getElementById('dtab-' + p);   if (btn) btn.className = 'deal-tab' + (p === key ? ' active' : '');
  });
}

function _loadTimeline(dealId) {
  zeke_sb.from('deal_messages').select('msg_type,content,created_at')
    .eq('deal_id', dealId).in('msg_type',['event','event_gold']).order('created_at',{ascending:true})
    .then(function (r) {
      var events = r.data || [];
      var w = document.getElementById('deal-timeline-wrap'); if (!w) return;
      var html = '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:14px">Deal Timeline</div>';
      if (!events.length) { html += '<div style="font-size:12px;color:#7B84A3">No events yet.</div>'; }
      else events.forEach(function (ev, i) {
        var isLast = i === events.length - 1;
        var c = ev.msg_type === 'event_gold' ? '#D97706' : '#059669';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;position:relative">';
        if (!isLast) html += '<div style="position:absolute;left:7px;top:22px;bottom:-4px;width:1px;background:#252A45"></div>';
        html += '<div style="width:15px;height:15px;border-radius:50%;border:2px solid '+c+';background:'+c+';flex-shrink:0;margin-top:2px"></div>';
        html += '<div style="font-size:12px;color:#C8D0E7;flex:1;line-height:1.4">' + esc(ev.content) + '</div>';
        html += '<div style="font-size:11px;color:#7B84A3;flex-shrink:0">' + fmtDate(ev.created_at) + '</div>';
        html += '</div>';
      });
      w.innerHTML = html;
    });
}

function _renderDeliverables(d) {
  var w = document.getElementById('deal-deliverables-wrap'); if (!w) return;
  w.innerHTML = '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px">Deliverables</div>'
    + '<div style="font-size:12px;color:#7B84A3;line-height:1.9">' + esc(d.deliverables || 'No deliverables specified.') + '</div>';
}

function _loadSubmissions(d) {
  zeke_sb.from('submissions').select('*').eq('deal_id', d.id).order('submitted_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('submissions-content'); if (!c) return;
      var subs = r.data || [];
      if (!subs.length) {
        c.innerHTML = '<div class="item-card" style="padding:16px">'
          + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:8px">Round 1</div>'
          + '<div id="sub-upload-area" onclick="document.getElementById(\'sub-file\').click()" style="border:2px dashed #252A45;border-radius:12px;padding:20px;text-align:center;cursor:pointer">'
          + '<div style="font-size:13px;font-weight:600;color:#C8D0E7;margin-bottom:4px">Upload Content File</div>'
          + '<div style="font-size:11px;color:#7B84A3">MP4, MOV, JPG up to 200MB</div>'
          + '<input id="sub-file" type="file" accept="video/*,image/*" style="display:none" onchange="handleFileSelect(this)"></div>'
          + '<div id="sub-file-preview" class="hidden" style="background:#0B0D1A;border:1px solid rgba(5,150,105,.3);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;margin-top:10px">'
          + '<div style="flex:1;min-width:0"><div id="sub-file-name" style="font-size:13px;font-weight:600;color:#fff">file</div>'
          + '<div id="sub-file-size" style="font-size:11px;color:#7B84A3">0 MB</div></div>'
          + '<button onclick="removeSubFile()" style="background:none;border:none;color:#7B84A3;cursor:pointer">×</button></div>'
          + '<button class="btn btn-primary btn-sm btn-full" onclick="submitFile(\'' + d.id + '\')" style="margin-top:12px">Submit for Review</button></div>';
      } else {
        c.innerHTML = subs.map(function (s) {
          var sc = s.status === 'approved' ? '#059669' : s.status === 'rejected' ? '#E94560' : '#D97706';
          return '<div class="item-card" style="margin-bottom:10px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
            + '<div style="font-size:13px;font-weight:700;color:#fff">Round ' + s.round + '</div>'
            + '<span style="font-size:11px;font-weight:700;color:' + sc + '">' + s.status.charAt(0).toUpperCase() + s.status.slice(1) + '</span></div>'
            + '<div style="background:#0B0D1A;border-radius:10px;padding:10px 12px;font-size:13px;color:#C8D0E7">' + esc(s.file_name||'submission') + ' · ' + (s.file_size_mb||'') + 'MB</div>'
            + (s.review_note ? '<div style="font-size:12px;color:' + sc + ';margin-top:8px;padding:8px 12px;background:rgba(0,0,0,.1);border-radius:8px">' + esc(s.review_note) + '</div>' : '')
            + '</div>';
        }).join('');
      }
    });
}

function handleFileSelect(input) {
  if (!input.files.length) return;
  var file = input.files[0];
  _set('sub-file-name', file.name);
  _set('sub-file-size', (file.size / 1048576).toFixed(1) + ' MB');
  document.getElementById('sub-file-preview').classList.remove('hidden');
  document.getElementById('sub-upload-area').style.display = 'none';
}

function removeSubFile() {
  document.getElementById('sub-file-preview').classList.add('hidden');
  document.getElementById('sub-upload-area').style.display = '';
  document.getElementById('sub-file').value = '';
}

function submitFile(dealId) {
  var fileInput = document.getElementById('sub-file');
  if (!fileInput || !fileInput.files.length) { alert('Please upload a file first.'); return; }
  var file = fileInput.files[0];
  var path = ZK.id + '/' + dealId + '/' + Date.now() + '_' + file.name;

  zeke_sb.storage.from('submissions').upload(path, file)
    .then(function (r) {
      if (r.error) { alert('Upload failed: ' + r.error.message); return null; }
      return zeke_sb.from('submissions').insert({ deal_id: dealId, file_url: path, file_name: file.name, file_size_mb: parseFloat((file.size/1048576).toFixed(1)), status:'pending' });
    })
    .then(function (r) {
      if (!r || r.error) return null;
      return Promise.all([
        zeke_sb.from('deals').update({ status:'submitted', updated_at: new Date().toISOString() }).eq('id', dealId),
        zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '✓ File submitted by ' + ZK.display_name + ' · Awaiting brand review' }),
        zeke_sb.from('deals').select('brand_id,title').eq('id', dealId).single()
      ]);
    })
    .then(function (results) {
      if (!results) return;
      var dealRes = results[2];
      if (dealRes && dealRes.data) {
        zeke_sb.from('notifications').insert({
          user_id: dealRes.data.brand_id,
          title: 'New submission from ' + ZK.display_name,
          body: dealRes.data.title + ' — review pending',
          type: 'deal'
        }).then(function () {});
      }
      document.getElementById('submissions-content').innerHTML =
        '<div style="background:rgba(5,150,105,.08);border:1px solid rgba(5,150,105,.25);border-radius:14px;padding:16px;font-size:13px;color:#059669;font-weight:600">✓ File submitted. Awaiting brand review.</div>';
    });
}

function _loadFinalLink(d) {
  zeke_sb.from('final_links').select('*').eq('deal_id', d.id).maybeSingle()
    .then(function (r) {
      var c = document.getElementById('finallink-content'); if (!c) return;
      if (!r.data) {
        var canSubmit = d.status === 'approved';
        c.innerHTML = canSubmit
          ? '<div style="background:#181C35;border:1px solid rgba(5,150,105,.2);border-radius:14px;padding:16px">'
            + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">Submit Live Link</div>'
            + '<input id="final-link-input" type="url" placeholder="https://instagram.com/p/..." style="width:100%;background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 14px;font-size:13px;color:#C8D0E7;outline:none;font-family:Inter,sans-serif;margin-bottom:10px">'
            + '<button class="btn btn-primary btn-sm btn-full" onclick="submitFinalLink(\'' + d.id + '\')">Submit Link</button></div>'
          : '<div style="background:#181C35;border:1px solid #252A45;border-radius:14px;padding:16px;opacity:.5"><div style="font-size:13px;font-weight:700;color:#fff">Final Link</div><div style="font-size:12px;color:#7B84A3;margin-top:6px">Available after brand approves your content.</div></div>';
      } else {
        c.innerHTML = '<div style="background:#181C35;border:1px solid rgba(5,150,105,.25);border-radius:14px;padding:16px">'
          + '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px">Submitted Link</div>'
          + '<div style="background:#0B0D1A;border-radius:10px;padding:10px 14px;font-size:13px;color:#059669;word-break:break-all">' + esc(r.data.url) + '</div>'
          + '<div style="font-size:11px;color:#7B84A3;margin-top:8px">Submitted ' + fmtDate(r.data.submitted_at) + '</div></div>';
      }
    });
}

function submitFinalLink(dealId) {
  var input = document.getElementById('final-link-input');
  var url = input ? input.value.trim() : '';
  if (!url) { alert('Enter the live URL.'); return; }
  zeke_sb.from('final_links').insert({ deal_id: dealId, url: url })
    .then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      return Promise.all([
        zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '✓ Final link submitted by ' + ZK.display_name }),
        zeke_sb.from('deals').update({ status:'link_submitted' }).eq('id', dealId)
      ]);
    })
    .then(function () {
      zeke_sb.from('deals').select('*').eq('id', dealId).single().then(function (r) { if (r.data) _loadFinalLink(r.data); });
    });
}

function _loadPayment(d) {
  zeke_sb.from('payments').select('*').eq('deal_id', d.id).maybeSingle()
    .then(function (r) {
      var c = document.getElementById('payment-content'); if (!c) return;
      if (!r.data) {
        c.innerHTML = '<div style="background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.25);border-radius:14px;padding:16px;opacity:.5"><div style="font-size:13px;font-weight:700;color:#D97706">Confirm Payment</div><div style="font-size:12px;color:#7B84A3;margin-top:6px">Available after brand marks payment as sent.</div></div>';
      } else if (r.data.status === 'confirmed') {
        c.innerHTML = '<div style="background:#181C35;border:1px solid rgba(5,150,105,.25);border-radius:14px;padding:16px"><div style="font-size:12px;color:#059669;padding:10px 12px;background:rgba(5,150,105,.06);border-radius:8px;font-weight:600">✓ ₹' + fmtNum(r.data.amount) + ' received and confirmed</div></div>';
      } else {
        c.innerHTML = '<div style="background:#181C35;border:1px solid rgba(217,119,6,.25);border-radius:14px;padding:16px">'
          + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:12px">Confirm Payment Received</div>'
          + '<div style="font-size:14px;color:#D97706;font-weight:700;margin-bottom:16px">₹' + fmtNum(r.data.amount) + ' sent by brand</div>'
          + '<button class="btn btn-primary btn-md btn-full" onclick="confirmPayment(\'' + r.data.id + '\',\'' + d.id + '\')">I have received the payment</button></div>';
      }
    });
}

function confirmPayment(paymentId, dealId) {
  zeke_sb.from('payments').update({ status:'confirmed', confirmed_by: ZK.id, confirmed_at: new Date().toISOString() }).eq('id', paymentId)
    .then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      return Promise.all([
        zeke_sb.from('deals').update({ status:'completed' }).eq('id', dealId),
        zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '✓ Payment confirmed by ' + ZK.display_name + ' · Deal complete' })
      ]);
    })
    .then(function () {
      zeke_sb.from('deals').select('*').eq('id', dealId).single().then(function (r) { if (r.data) _loadPayment(r.data); });
    });
}

function _renderCancel(d) {
  var c = document.getElementById('cancel-content'); if (!c) return;
  if (d.status === 'completed' || d.status === 'cancelled') {
    c.innerHTML = '<div style="background:rgba(123,132,163,.08);border:1px solid #252A45;border-radius:10px;padding:12px;font-size:12px;color:#7B84A3;text-align:center">Cancellation not available for this deal.</div>';
  } else {
    c.innerHTML = '<div style="font-size:12px;color:#7B84A3;line-height:1.7;margin-bottom:12px">Send a cancellation request. The brand must agree before the deal is cancelled.</div>'
      + '<textarea id="cancel-reason" placeholder="Reason for cancellation..." style="width:100%;background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 14px;font-size:13px;color:#C8D0E7;outline:none;font-family:Inter,sans-serif;resize:vertical;min-height:80px;margin-bottom:10px"></textarea>'
      + '<button onclick="requestCancel(\'' + d.id + '\')" style="width:100%;background:rgba(233,69,96,.1);color:#E94560;border:1px solid rgba(233,69,96,.3);border-radius:8px;padding:10px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer">Send Request</button>';
  }
}

function requestCancel(dealId) {
  var reason = document.getElementById('cancel-reason') ? document.getElementById('cancel-reason').value.trim() : '';
  if (!reason) { alert('Please provide a reason.'); return; }
  zeke_sb.from('deals').update({ cancel_requested_by: ZK.id, cancel_reason: reason }).eq('id', dealId)
    .then(function (r) {
      if (r && r.error) { alert(r.error.message); return; }
      zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '⊘ Cancellation requested by ' + ZK.display_name + ': ' + reason }).then(function () {});
      zeke_sb.from('deals').select('brand_id,title').eq('id', dealId).single().then(function (rr) {
        if (rr && rr.data) {
          zeke_sb.from('notifications').insert({ user_id: rr.data.brand_id, title: 'Cancellation requested', body: ZK.display_name + ' wants to cancel ' + rr.data.title, type: 'deal' }).then(function () {});
        }
      });
      document.getElementById('cancel-content').innerHTML =
        '<div style="background:rgba(217,119,6,.06);border:1px solid rgba(217,119,6,.2);border-radius:10px;padding:12px;font-size:12px;color:#D97706;font-weight:600">⊘ Cancellation request sent. The brand must agree before the deal closes.</div>';
    });
}

// ── AGREEMENTS ────────────────────────────────────────────
function loadAgreements() {
  zeke_sb.from('agreements')
    .select('*, deals(id, title, amount, deliverables, platform, deadline, profiles!deals_brand_id_fkey(display_name))')
    .then(function (r) {
      var c = document.getElementById('agreements-list'); if (!c) return;
      var rows = (r.data || []).filter(function (a) { return a.deals; });
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No agreements yet.</div>'; return; }
      var isShield = !!(ZK.inf && ZK.inf.shield_active);
      c.innerHTML = rows.map(function (a) {
        var d = a.deals;
        var brand = (d.profiles && d.profiles.display_name) || 'Brand';
        var pdfBtn = isShield
          ? '<button class="btn btn-outline btn-sm" style="flex:1" onclick="downloadAgreementPDF(\'' + a.id + '\')">⬇ Download PDF</button>'
          : '<div style="font-size:11px;color:#7B84A3;text-align:center;margin-top:4px">🛡 PDF available to Shield members only.</div>';
        return '<div class="item-card" style="border-color:rgba(5,150,105,.25);margin-bottom:12px">'
          + '<div class="item-card-header"><div style="display:flex;align-items:center;gap:12px">'
          + '<div style="width:40px;height:40px;background:rgba(5,150,105,.1);border:1px solid rgba(5,150,105,.25);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>'
          + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(brand) + ' × ' + esc(ZK.display_name) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + fmtDate(a.generated_at) + '</div></div>'
          + '</div><span class="badge badge-green">Active</span></div>'
          + '<div style="background:#0B0D1A;border-radius:10px;padding:10px 14px;font-size:12px;color:#7B84A3;line-height:1.9;margin-top:10px">'
          + '<div><span style="color:#C8D0E7;font-weight:600">Title:</span> ' + esc(d.title||'') + '</div>'
          + '<div><span style="color:#C8D0E7;font-weight:600">Platform:</span> ' + esc(d.platform||'—') + '</div>'
          + '<div><span style="color:#C8D0E7;font-weight:600">Value:</span> ₹' + fmtNum(d.amount||0) + '</div>'
          + (d.deliverables ? '<div><span style="color:#C8D0E7;font-weight:600">Deliverables:</span> ' + esc(d.deliverables) + '</div>' : '')
          + (d.deadline ? '<div><span style="color:#C8D0E7;font-weight:600">Deadline:</span> ' + esc(d.deadline) + '</div>' : '')
          + '</div>'
          + '<div class="item-actions" style="margin-top:10px">' + pdfBtn + '</div></div>';
      }).join('');
    });
}

// Client-side PDF generation for Shield members.
function downloadAgreementPDF(agreementId) {
  if (!window.jspdf) { alert('PDF library failed to load. Please refresh.'); return; }
  zeke_sb.from('agreements')
    .select('*, deals(title, amount, deliverables, platform, deadline, payment_terms, usage_rights, profiles!deals_brand_id_fkey(display_name))')
    .eq('id', agreementId).single()
    .then(function (r) {
      if (r.error || !r.data) { alert('Could not load agreement.'); return; }
      var a = r.data, d = a.deals || {};
      var brand = (d.profiles && d.profiles.display_name) || 'Brand';
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var y = 20;
      doc.setFont('helvetica','bold').setFontSize(20).text('ZEKE', 20, y); y += 8;
      doc.setFont('helvetica','normal').setFontSize(10).setTextColor(120).text('Legally Protected Influencer Marketplace', 20, y); y += 14;
      doc.setTextColor(0).setFontSize(14).setFont('helvetica','bold').text('Deal Agreement', 20, y); y += 10;
      doc.setFontSize(10).setFont('helvetica','normal');
      var lines = [
        ['Brand', brand],
        ['Creator', ZK.display_name],
        ['Title', d.title || '—'],
        ['Platform', d.platform || '—'],
        ['Value', '₹' + (d.amount || 0)],
        ['Deliverables', d.deliverables || '—'],
        ['Usage rights', d.usage_rights || 'As agreed'],
        ['Payment terms', d.payment_terms || 'On completion'],
        ['Deadline', d.deadline || 'As agreed'],
        ['Generated', new Date(a.generated_at).toLocaleString()]
      ];
      lines.forEach(function (kv) {
        doc.setFont('helvetica','bold').text(kv[0] + ':', 20, y);
        var wrapped = doc.splitTextToSize(String(kv[1]), 140);
        doc.setFont('helvetica','normal').text(wrapped, 60, y);
        y += Math.max(8, wrapped.length * 6);
        if (y > 260) { doc.addPage(); y = 20; }
      });
      y += 6;
      doc.setFontSize(9).setTextColor(120);
      var disclaimer = doc.splitTextToSize('This agreement is generated by Zeke based on the deal terms accepted by both parties. Both parties confirmed acceptance digitally on the platform. Any dispute will be reviewed by the Zeke team for Shield members.', 170);
      doc.text(disclaimer, 20, y);
      doc.save('zeke-agreement-' + (d.title || 'deal').replace(/\s+/g,'-').toLowerCase() + '.pdf');
    });
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function loadNotifications() {
  zeke_sb.from('notifications').select('*').eq('user_id', ZK.id).order('created_at',{ascending:false}).limit(10)
    .then(function (r) {
      var notifs = r.data || [];
      var dot = document.getElementById('main-notif-dot');
      if (dot) dot.style.display = notifs.some(function (n) { return !n.read; }) ? 'block' : 'none';
      var inner = document.getElementById('notif-panel-inner'); if (!inner) return;
      var header = '<div class="notif-header"><div class="notif-title">Notifications</div><button class="notif-clear" onclick="clearNotifs()">Mark all read</button></div>';
      if (!notifs.length) { inner.innerHTML = header + '<div style="padding:20px;text-align:center;font-size:13px;color:#7B84A3">No notifications yet.</div>'; return; }
      inner.innerHTML = header + notifs.map(function (n) {
        return '<div class="notif-item' + (!n.read ? ' unread' : '') + '">'
          + '<div class="notif-icon" style="background:rgba(233,69,96,.12);color:#E94560"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>'
          + '<div class="notif-body"><div class="notif-body-title">' + esc(n.title) + '</div><div class="notif-body-sub">' + esc(n.body||'') + '</div></div>'
          + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div class="notif-time">' + fmtDate(n.created_at) + '</div>'
          + (!n.read ? '<div class="notif-unread-dot"></div>' : '') + '</div></div>';
      }).join('');
    });
}

// ── UTILS ─────────────────────────────────────────────────
function _si(status) {
  var map = {
    completed:    { label:'Paid',        color:'#059669', bg:'rgba(5,150,105,.03)',   border:'rgba(5,150,105,.3)',   badge:'badge-green'  },
    active:       { label:'Active',      color:'#E94560', bg:'rgba(233,69,96,.03)',   border:'rgba(233,69,96,.3)',   badge:'badge-accent' },
    negotiating:  { label:'Negotiating', color:'#7B84A3', bg:'rgba(123,132,163,.03)', border:'rgba(123,132,163,.3)', badge:'badge-muted'  },
    submitted:    { label:'Submitted',   color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    approved:     { label:'Approved',    color:'#059669', bg:'rgba(5,150,105,.03)',   border:'rgba(5,150,105,.3)',   badge:'badge-green'  },
    link_submitted:{ label:'Link Sent',  color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    payment_sent: { label:'Paying',      color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    disputed:     { label:'Disputed',    color:'#E94560', bg:'rgba(233,69,96,.03)',   border:'rgba(233,69,96,.3)',   badge:'badge-accent' },
    cancelled:    { label:'Cancelled',   color:'#7B84A3', bg:'rgba(123,132,163,.03)', border:'rgba(123,132,163,.3)', badge:'badge-muted'  }
  };
  return map[status] || map.negotiating;
}

function _set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
function _val(id, val) { var el = document.getElementById(id); if (el) el.value = val; }

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts), now = new Date(), diff = Math.floor((now - d) / 60000);
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff/60) + 'h ago';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── RAISE DISPUTE ─────────────────────────────────────────
function raiseDispute() {
  if (!_activeDeal) return;
  var dealId = _activeDeal;
  var inf = ZK.inf || {};
  var isShield = !!inf.shield_active;
  var prefix = isShield
    ? '🛡 You are a Shield member — the Zeke team will personally review this dispute and work toward a fair resolution.\n\n'
    : 'Free creators can raise disputes, but Zeke will not actively intervene without a Shield membership. The dispute will be recorded.\n\n';
  var reason = prompt(prefix + 'Describe the issue (the brand and Zeke admin will see this):');
  if (!reason || !reason.trim()) return;
  reason = reason.trim();

  zeke_sb.from('deals').select('brand_id,title,status').eq('id', dealId).single()
    .then(function (r) {
      if (r.error || !r.data) { alert('Could not load deal.'); return null; }
      var d = r.data;
      if (d.status === 'disputed')  { alert('A dispute is already open on this deal.'); return null; }
      if (d.status === 'completed' || d.status === 'cancelled') { alert('This deal is closed; you cannot raise a dispute.'); return null; }
      return Promise.all([
        zeke_sb.from('disputes').insert({ deal_id: dealId, raised_by: ZK.id, reason: reason, status: 'open' }),
        zeke_sb.from('deals').update({ status: 'disputed', updated_at: new Date().toISOString() }).eq('id', dealId),
        zeke_sb.from('deal_messages').insert({
          deal_id: dealId, sender_id: ZK.id,
          msg_type: isShield ? 'event_gold' : 'event',
          content: (isShield ? '🛡 ' : '⚠ ') + 'Dispute raised by ' + ZK.display_name + ': ' + reason
        }),
        zeke_sb.from('notifications').insert({
          user_id: d.brand_id,
          title: 'Dispute opened',
          body: ZK.display_name + ' raised a dispute on ' + d.title,
          type: 'system'
        })
      ]);
    })
    .then(function (results) {
      if (!results) return;
      alert(isShield
        ? '🛡 Dispute submitted. The Zeke team will reach out within 24 hours.'
        : '⚠ Dispute recorded. Upgrade to Zeke Shield for active resolution support.');
      loadDeals(); loadOverview();
      if (_activeDeal === dealId) openDeal(dealId);
    });
}

// ── SHIELD REQUEST ────────────────────────────────────────
function requestShield() {
  var inf = ZK.inf || {};
  if (inf.shield_active) { alert('You are already a Shield member.'); return; }
  if (!confirm('Request Zeke Shield (₹1,999/yr)? Our team will follow up to confirm payment, then activate your Shield within 24h.')) return;
  zeke_sb.from('shield_requests').select('id,status').eq('influencer_id', ZK.id).eq('status','pending').maybeSingle()
    .then(function (r) {
      if (r.data) { _renderShieldUpsell('pending'); alert('Your Shield request is already pending review.'); return null; }
      return zeke_sb.from('shield_requests').insert({ influencer_id: ZK.id, amount: 1999, status: 'pending' });
    })
    .then(function (r) {
      if (!r) return;
      if (r.error) { alert(r.error.message); return; }
      _renderShieldUpsell('pending');
      alert('🛡 Shield requested. We will email you with payment instructions shortly.');
    });
}

function _renderShieldUpsell(state) {
  var card = document.getElementById('shield-upsell-card'); if (!card) return;
  var btn  = document.getElementById('shield-cta-btn');
  var sub  = document.getElementById('shield-upsell-sub');
  if (state === 'active') {
    card.style.borderColor = 'rgba(217,119,6,.4)';
    card.style.background  = 'rgba(217,119,6,.08)';
    if (sub) sub.textContent = 'You are a Shield member. Thank you for backing Zeke.';
    if (btn) { btn.textContent = '🛡 Active'; btn.disabled = true; btn.style.opacity = '.7'; btn.onclick = null; }
  } else if (state === 'pending') {
    if (sub) sub.textContent = 'Shield request submitted. Awaiting activation.';
    if (btn) { btn.textContent = 'Pending'; btn.disabled = true; btn.style.opacity = '.7'; btn.onclick = null; }
  }
}

function _refreshShieldUpsellState() {
  var inf = ZK.inf || {};
  if (inf.shield_active) { _renderShieldUpsell('active'); return; }
  zeke_sb.from('shield_requests').select('id').eq('influencer_id', ZK.id).eq('status','pending').maybeSingle()
    .then(function (r) { if (r && r.data) _renderShieldUpsell('pending'); });
}

// ── REALTIME NOTIFICATIONS ────────────────────────────────
function subscribeToNotifications() {
  zeke_sb.channel('creator-notifs:' + ZK.id)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:'user_id=eq.'+ZK.id },
      function () { loadNotifications(); })
    .subscribe();
}

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('zeke:ready', function () {
  loadNotifications();
  subscribeToNotifications();
  _refreshShieldUpsellState();
  var initial = (window.location.hash || '').replace('#','');
  if (!initial || ['overview','offers','chats','deals','agreements','profile'].indexOf(initial) === -1) initial = 'overview';
  switchTab(initial);
  setMob(initial);
});
