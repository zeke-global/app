/* ═══════════════════════════════════════
   ZEKE — BRAND JS
   Requires session.js → window.ZK ready
═══════════════════════════════════════ */

var _allCreators  = [];
var _activeBChat  = null;
var _activeBDeal  = null;
var _bChatChannel = null;

// ── TABS ──────────────────────────────────────────────────
function bSwitchTab(tab) {
  ['overview','campaigns','chats','deals','discover','profile'].forEach(function (t) {
    var el  = document.getElementById('btab-' + t);     if (el)  el.classList.toggle('hidden', t !== tab);
    var btn = document.getElementById('brand-tab-' + t); if (btn) btn.className = 'sidebar-nav-btn' + (t === tab ? ' active-tab' : '');
  });
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '#' + tab);
  }
  // Refresh data on every switch so admin/brand actions in another tab show up.
  if (tab === 'overview')  loadBrandOverview();
  if (tab === 'campaigns') loadBrandCampaigns();
  if (tab === 'chats')     loadBrandChats();
  if (tab === 'deals')     loadBrandDeals();
  if (tab === 'discover')  loadAllCreators();
}

function bSetMob(tab) {
  ['overview','campaigns','chats','deals','discover'].forEach(function (t) {
    var b = document.getElementById('bmob-' + t); if (b) b.className = 'mob-nav-btn' + (t === tab ? ' active' : '');
  });
}

// ── POPULATE UI ───────────────────────────────────────────
function populateBrandUI() {
  var name     = ZK.display_name || 'Brand';
  var initials = name.slice(0,2).toUpperCase();
  var loc      = ZK.location || '';
  var type     = (ZK.brand && ZK.brand.brand_type) ? ZK.brand.brand_type : 'Brand';
  var sub      = [type, loc].filter(Boolean).join(' · ');

  _set('sidebar-brand-avatar', initials);
  _set('sidebar-brand-name',   name);
  _set('sidebar-brand-sub',    sub);
  _set('brand-greeting',       'Welcome, ' + name);
  _set('brand-sub',            sub);
  _set('profile-avatar-large', initials);
  _set('profile-brand-name',   name);
  _set('profile-brand-sub',    loc);
  _set('profile-brand-type',   type.charAt(0).toUpperCase() + type.slice(1));
}

// ── OVERVIEW ─────────────────────────────────────────────
function loadBrandOverview() {
  var uid = ZK.id;

  zeke_sb.from('campaigns').select('id',{count:'exact',head:true}).eq('brand_id',uid).eq('status','active')
    .then(function (r) {
      _set('bstat-campaigns', r.count || 0);
      var b = document.getElementById('campaigns-count');
      if (b && r.count > 0) { b.textContent = r.count; b.style.display = 'inline'; }
    });

  zeke_sb.from('deals').select('id',{count:'exact',head:true}).eq('brand_id',uid).not('status','in','("completed","cancelled")')
    .then(function (r) {
      _set('bstat-deals', r.count || 0);
      var b = document.getElementById('deals-count');
      if (b && r.count > 0) { b.textContent = r.count; b.style.display = 'inline'; }
    });

  zeke_sb.from('deals').select('amount').eq('brand_id',uid).eq('status','completed')
    .then(function (r) {
      var total = (r.data||[]).reduce(function(s,d){ return s+(d.amount||0); }, 0);
      _set('bstat-spent', '₹' + fmtNum(total));
      _set('profile-stat-spent', '₹' + fmtNum(total));
    });

  // Campaigns preview
  zeke_sb.from('campaigns').select('*').eq('brand_id',uid).eq('status','active').order('created_at',{ascending:false}).limit(2)
    .then(function (r) { _renderCampaigns('boverview-campaigns', r.data||[], false); });

  // Recommended creators (Shield only)
  zeke_sb.from('influencer_profiles')
    .select('id,niche,ig_followers,rating,shield_active,handle,profiles!influencer_profiles_id_fkey(display_name,location)')
    .eq('shield_active',true).order('ig_followers',{ascending:false}).limit(4)
    .then(function (r) { _renderCreatorGrid('boverview-creators', r.data||[], false); });

  _loadBrandDealHistory();
}

// ── CAMPAIGNS ─────────────────────────────────────────────
function loadBrandCampaigns() {
  zeke_sb.from('campaigns').select('*').eq('brand_id',ZK.id).order('created_at',{ascending:false})
    .then(function (r) { _renderCampaigns('bcampaigns-list', r.data||[], true); });
}

function _renderCampaigns(containerId, campaigns, expanded) {
  var c = document.getElementById(containerId); if (!c) return;
  if (!campaigns.length) { c.innerHTML = '<div class="empty-state">No campaigns yet.</div>'; return; }
  c.innerHTML = campaigns.map(function (item) {
    var sc = item.status === 'active' ? 'badge-green' : 'badge-muted';
    return '<div class="item-card" style="margin-bottom:12px">'
      + '<div class="item-card-header">'
      + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(item.title) + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(item.niche||'') + (item.deadline ? ' · Deadline ' + fmtDateShort(item.deadline) : '') + '</div></div>'
      + '<div style="text-align:right"><div style="font-size:14px;font-weight:900;color:#D97706">₹' + fmtNum(item.budget||0) + '</div>'
      + '<span class="badge ' + sc + '" style="margin-top:4px">' + (item.status||'Active') + '</span></div></div>'
      + (expanded
          ? (item.status === 'active'
              ? '<div class="item-actions"><button class="btn btn-primary btn-sm" style="flex:1" onclick="openCampaignSendModal(\'' + item.id + '\')">&#10148; Send to Creators</button><button class="btn btn-outline btn-sm" onclick="deleteCampaign(\'' + item.id + '\')">Close</button></div>'
              : '<div class="item-actions"><button class="btn btn-ghost btn-sm" disabled>Closed</button></div>')
          : '')
      + '</div>';
  }).join('');
}

function showCreateCampaign() {
  var f = document.getElementById('create-campaign-form'); if (f) f.classList.remove('hidden');
}

function hideCreateCampaign() {
  var f = document.getElementById('create-campaign-form'); if (f) f.classList.add('hidden');
  hideErr('camp-error');
  ['camp-title','camp-budget','camp-description'].forEach(function (id) { var el=document.getElementById(id); if(el) el.value=''; });
}

function createCampaign() {
  var title  = (document.getElementById('camp-title')       ||{}).value.trim();
  var niche  = (document.getElementById('camp-niche')       ||{}).value;
  var budget = (document.getElementById('camp-budget')      ||{}).value;
  var deadline=(document.getElementById('camp-deadline')    ||{}).value;
  var desc   = (document.getElementById('camp-description') ||{}).value.trim();
  if (!title)  { showErr('camp-error','Enter a campaign title.'); return; }
  if (!niche)  { showErr('camp-error','Select a niche.'); return; }
  if (!budget) { showErr('camp-error','Enter a budget.'); return; }
  hideErr('camp-error');
  setBtnLoading('post-campaign-btn', true, 'Post Campaign');
  zeke_sb.from('campaigns').insert({ brand_id:ZK.id, title, niche, budget:parseFloat(budget), deadline:deadline||null, description:desc, status:'active' })
    .then(function (r) {
      setBtnLoading('post-campaign-btn', false, 'Post Campaign');
      if (r.error) { showErr('camp-error', r.error.message); return; }
      hideCreateCampaign(); loadBrandCampaigns(); loadBrandOverview();
    });
}

function deleteCampaign(id) {
  if (!confirm('Close this campaign?')) return;
  zeke_sb.from('campaigns').update({status:'closed'}).eq('id',id).then(function () { loadBrandCampaigns(); });
}

// ── CHATS ─────────────────────────────────────────────────
function loadBrandChats() {
  zeke_sb.from('deals')
    .select('id,title,status,updated_at,profiles!deals_influencer_id_fkey(display_name)')
    .eq('brand_id',ZK.id).not('status','eq','cancelled').order('updated_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('brand-chats-list-inner'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No active chats yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) {
        var creator = (d.profiles && d.profiles.display_name) || 'Creator';
        var si = _si(d.status);
        return '<div class="item-card" style="cursor:pointer;margin-bottom:8px" onclick="openBrandChat(\'' + d.id + '\',\'' + esc(creator) + '\')">'
          + '<div style="display:flex;align-items:center;gap:14px">'
          + '<div class="item-avatar" style="color:' + si.color + '">' + creator.slice(0,2).toUpperCase() + '</div>'
          + '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff">' + esc(creator) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(d.title||'') + '</div></div>'
          + '<span class="badge ' + si.badge + '">' + si.label + '</span></div></div>';
      }).join('');
    });
}

function openBrandChat(dealId, creatorName) {
  _activeBChat = dealId;
  document.getElementById('brand-chats-list').classList.add('hidden');
  var win = document.getElementById('brand-chats-window');
  win.classList.remove('hidden'); win.style.display = 'flex';
  _set('brand-chat-creator-name', creatorName);
  var av = document.getElementById('brand-chat-avatar');
  if (av) av.textContent = creatorName.slice(0,2).toUpperCase();
  zeke_sb.from('deals').select('title,amount,status').eq('id', dealId).single()
    .then(function (r) {
      if (r && r.data) {
        var d = r.data;
        var sub = (d.title || '') + (d.amount ? ' · ₹' + fmtNum(d.amount) : '');
        _set('brand-chat-deal-sub', sub || _si(d.status).label);
      }
    });
  _loadBrandChatMsgs(dealId);
  _subscribeBrandChat(dealId);
}

function closeBrandChat() {
  _activeBChat = null;
  if (_bChatChannel) { zeke_sb.removeChannel(_bChatChannel); _bChatChannel = null; }
  var win  = document.getElementById('brand-chats-window');
  var list = document.getElementById('brand-chats-list');
  if (win)  { win.classList.add('hidden'); win.style.display = 'none'; }
  if (list) list.classList.remove('hidden');
}

function _loadBrandChatMsgs(dealId) {
  zeke_sb.from('deal_messages').select('*').eq('deal_id',dealId).order('created_at',{ascending:true})
    .then(function (r) {
      var c = document.getElementById('brand-chat-messages'); if (!c) return;
      c.innerHTML = '';
      (r.data||[]).forEach(function (m) { _appendBrandMsg(m); });
      setTimeout(function () { c.scrollTop = c.scrollHeight; }, 50);
    });
}

function _appendBrandMsg(m) {
  var c = document.getElementById('brand-chat-messages'); if (!c) return;
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
    div.innerHTML = '<div class="chat-bubble-in"><div style="font-size:13px;color:#C8D0E7">' + esc(m.content) + '</div><div style="font-size:10px;color:#7B84A3;margin-top:4px">Creator · ' + fmtDate(m.created_at) + '</div></div>';
  }
  c.appendChild(div); c.scrollTop = c.scrollHeight;
}

function _subscribeBrandChat(dealId) {
  if (_bChatChannel) zeke_sb.removeChannel(_bChatChannel);
  _bChatChannel = zeke_sb.channel('bchat:' + dealId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'deal_messages',filter:'deal_id=eq.'+dealId},
      function (p) { if (p.new.sender_id !== ZK.id) _appendBrandMsg(p.new); })
    .subscribe();
}

function sendBrandMessage() {
  if (!_activeBChat) return;
  var input = document.getElementById('brand-chat-input'); if (!input) return;
  var text = input.value.trim(); if (!text) return;
  input.value = '';
  _appendBrandMsg({ sender_id: ZK.id, msg_type:'text', content: text, created_at: new Date().toISOString() });
  zeke_sb.from('deal_messages').insert({ deal_id: _activeBChat, sender_id: ZK.id, msg_type:'text', content: text })
    .then(function (r) { if (r && r.error) console.error('chat send failed:', r.error.message); });
}

// ── DEALS ─────────────────────────────────────────────────
function loadBrandDeals() {
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,updated_at,profiles!deals_influencer_id_fkey(display_name)')
    .eq('brand_id',ZK.id).not('status','eq','cancelled').order('updated_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('brand-deals-list-inner'); if (!c) return;
      var rows = r.data || [];
      _set('profile-stat-deals', rows.filter(function(d){ return d.status==='completed'; }).length);
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No deals yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) {
        var creator = (d.profiles && d.profiles.display_name) || 'Creator';
        var si = _si(d.status);
        return '<div class="item-card" style="border-color:' + si.border + ';background:' + si.bg + ';cursor:pointer;margin-bottom:12px" onclick="openBrandDeal(\'' + d.id + '\',\'' + esc(creator) + '\')">'
          + '<div class="item-card-header">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div class="item-avatar" style="color:' + si.color + '">' + creator.slice(0,2).toUpperCase() + '</div>'
          + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(creator) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + esc(d.platform||'') + '</div></div></div>'
          + '<div style="text-align:right"><div style="font-size:14px;font-weight:900;color:' + si.color + '">₹' + fmtNum(d.amount||0) + '</div>'
          + '<span class="badge ' + si.badge + '" style="margin-top:4px">' + si.label + '</span></div></div>'
          + '<div style="font-size:12px;color:#E94560;font-weight:600;text-align:right">View deal →</div></div>';
      }).join('');
    });
}

function openBrandDeal(dealId, creatorName) {
  _activeBDeal = dealId;
  document.getElementById('brand-deals-list').classList.add('hidden');
  document.getElementById('brand-deals-detail').classList.remove('hidden');
  zeke_sb.from('deals').select('*').eq('id',dealId).single()
    .then(function (r) {
      if (r.error || !r.data) return;
      var d = r.data; var si = _si(d.status);
      var pct = {negotiating:10,active:30,submitted:55,approved:70,link_submitted:80,payment_sent:90,completed:100}[d.status]||30;
      _set('bdeal-creator-name', creatorName||'Creator');
      _set('bdeal-sub', d.title + ' · ₹' + fmtNum(d.amount||0));
      var badge = document.getElementById('bdeal-status-badge'); badge.textContent = si.label; badge.className = 'badge ' + si.badge;
      var fill  = document.getElementById('bdeal-progress-fill'); fill.style.width = pct+'%'; fill.style.background = si.color;
      _set('bdeal-progress-label', si.label); document.getElementById('bdeal-progress-label').style.color = si.color;
      _loadBrandTimeline(dealId);
      _renderBrandDeliverables(d);
      _renderBrandCancelRequest(d);
      _loadBrandReview(dealId, d.status);
      _loadBrandPaymentPanel(dealId, d);
      _loadBrandAgreement(dealId);
      switchBrandDealTab('overview');
    });
  window.scrollTo(0,0);
}

function closeBrandDeal() {
  _activeBDeal = null;
  document.getElementById('brand-deals-detail').classList.add('hidden');
  document.getElementById('brand-deals-list').classList.remove('hidden');
}

function switchBrandDealTab(key) {
  ['overview','review','payment','agreement'].forEach(function (p) {
    var el  = document.getElementById('bdpanel-' + p); if (el)  el.classList.toggle('hidden', p !== key);
    var btn = document.getElementById('bdtab-' + p);   if (btn) btn.className = 'deal-tab' + (p === key ? ' active' : '');
  });
}

function _loadBrandTimeline(dealId) {
  zeke_sb.from('deal_messages').select('msg_type,content,created_at').eq('deal_id',dealId).in('msg_type',['event','event_gold']).order('created_at',{ascending:true})
    .then(function (r) {
      var w = document.getElementById('bdeal-timeline-wrap'); if (!w) return;
      var events = r.data || [];
      var html = '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:14px">Deal Timeline</div>';
      if (!events.length) { html += '<div style="font-size:12px;color:#7B84A3">No events yet.</div>'; }
      else events.forEach(function (ev, i) {
        var isLast = i === events.length - 1;
        var c = ev.msg_type === 'event_gold' ? '#D97706' : '#059669';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;position:relative">';
        if (!isLast) html += '<div style="position:absolute;left:7px;top:22px;bottom:-4px;width:1px;background:#252A45"></div>';
        html += '<div style="width:15px;height:15px;border-radius:50%;border:2px solid '+c+';background:'+c+';flex-shrink:0;margin-top:2px"></div>';
        html += '<div style="font-size:12px;color:#C8D0E7;flex:1;line-height:1.4">' + esc(ev.content) + '</div>';
        html += '<div style="font-size:11px;color:#7B84A3;flex-shrink:0">' + fmtDate(ev.created_at) + '</div></div>';
      });
      w.innerHTML = html;
    });
}

function _renderBrandDeliverables(d) {
  var w = document.getElementById('bdeal-deliverables-wrap'); if (!w) return;
  w.innerHTML = '<div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:8px">Deliverables</div><div style="font-size:12px;color:#7B84A3;line-height:1.9">' + esc(d.deliverables||'No deliverables specified.') + '</div>';
}

function raiseBrandDispute() {
  if (!_activeBDeal) return;
  var dealId = _activeBDeal;
  var reason = prompt('Describe the issue with this deal (the creator and Zeke admin will see this):');
  if (!reason || !reason.trim()) return;
  reason = reason.trim();

  zeke_sb.from('deals').select('influencer_id,title,status').eq('id', dealId).single()
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
          msg_type: 'event',
          content: '⚠ Dispute raised by ' + ZK.display_name + ': ' + reason
        }),
        zeke_sb.from('notifications').insert({
          user_id: d.influencer_id,
          title: 'Dispute opened',
          body: ZK.display_name + ' raised a dispute on ' + d.title,
          type: 'system'
        })
      ]);
    })
    .then(function (results) {
      if (!results) return;
      alert('⚠ Dispute submitted. The Zeke team will review.');
      loadBrandDeals();
      if (_activeBDeal === dealId) openBrandDeal(dealId, '');
    });
}

function _renderBrandCancelRequest(d) {
  var host = document.getElementById('bdpanel-overview'); if (!host) return;
  var existing = document.getElementById('brand-cancel-banner');
  if (existing) existing.remove();
  if (!d.cancel_requested_by || d.cancel_requested_by === ZK.id || d.status === 'cancelled' || d.status === 'completed') return;
  var banner = document.createElement('div');
  banner.id = 'brand-cancel-banner';
  banner.style.cssText = 'background:rgba(233,69,96,.06);border:1px solid rgba(233,69,96,.25);border-radius:14px;padding:16px;margin-bottom:14px';
  banner.innerHTML = '<div style="font-size:13px;font-weight:700;color:#E94560;margin-bottom:6px">⊘ Cancellation requested by creator</div>'
    + '<div style="font-size:12px;color:#C8D0E7;line-height:1.6;margin-bottom:12px">' + esc(d.cancel_reason||'') + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="btn-approve" style="flex:1" onclick="acceptCancel(\'' + d.id + '\')">Accept Cancellation</button>'
    + '<button class="btn-reject" onclick="declineCancel(\'' + d.id + '\')">Decline</button></div>';
  host.insertBefore(banner, host.firstChild);
}

function acceptCancel(dealId) {
  if (!confirm('Cancel this deal?')) return;
  zeke_sb.from('deals').update({ status:'cancelled' }).eq('id', dealId)
    .then(function (r) {
      if (r && r.error) { alert(r.error.message); return; }
      zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '⊘ Cancellation accepted by ' + ZK.display_name + ' · Deal cancelled' }).then(function () {});
      zeke_sb.from('deals').select('influencer_id,title').eq('id', dealId).single().then(function (rr) {
        if (rr && rr.data) {
          zeke_sb.from('notifications').insert({ user_id: rr.data.influencer_id, title: 'Deal cancelled', body: rr.data.title + ' has been cancelled.', type: 'deal' }).then(function () {});
        }
      });
      closeBrandDeal(); loadBrandDeals();
    });
}

function declineCancel(dealId) {
  zeke_sb.from('deals').update({ cancel_requested_by: null, cancel_reason: null }).eq('id', dealId)
    .then(function (r) {
      if (r && r.error) { alert(r.error.message); return; }
      zeke_sb.from('deal_messages').insert({ deal_id: dealId, sender_id: ZK.id, msg_type:'event', content: '✕ Cancellation declined by ' + ZK.display_name }).then(function () {});
      zeke_sb.from('deals').select('influencer_id,title').eq('id', dealId).single().then(function (rr) {
        if (rr && rr.data) {
          zeke_sb.from('notifications').insert({ user_id: rr.data.influencer_id, title: 'Cancellation declined', body: 'The brand declined cancellation of ' + rr.data.title, type: 'deal' }).then(function () {});
        }
      });
      var banner = document.getElementById('brand-cancel-banner'); if (banner) banner.remove();
    });
}

function _loadBrandReview(dealId, status) {
  zeke_sb.from('submissions').select('*').eq('deal_id',dealId).order('submitted_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('brand-review-content'); if (!c) return;
      var subs = r.data || [];
      if (!subs.length) { c.innerHTML = '<div class="empty-state">No submissions yet.</div>'; return; }
      c.innerHTML = subs.map(function (s) {
        var isPending = s.status === 'pending';
        var sc = isPending ? 'rgba(217,119,6,.25)' : (s.status==='approved' ? 'rgba(5,150,105,.25)' : 'rgba(233,69,96,.25)');
        var sl = isPending ? 'badge-gold' : (s.status==='approved' ? 'badge-green' : 'badge-accent');
        return '<div style="background:#181C35;border:1px solid ' + sc + ';border-radius:14px;padding:14px;margin-bottom:10px">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
          + '<div style="font-size:13px;font-weight:700;color:#fff">Round ' + s.round + '</div>'
          + '<span class="badge ' + sl + '">' + (isPending ? 'Awaiting Review' : s.status.charAt(0).toUpperCase()+s.status.slice(1)) + '</span></div>'
          + (s.file_name ? '<div style="background:#0B0D1A;border-radius:10px;padding:10px 12px;font-size:13px;color:#C8D0E7;margin-bottom:12px">' + esc(s.file_name) + ' · ' + (s.file_size_mb||'') + 'MB</div>' : '')
          + (isPending ? '<div style="display:flex;gap:8px"><button class="btn-approve" style="flex:1" onclick="reviewSubmission(\'' + s.id + '\',\'' + dealId + '\',\'approved\')">&#10003; Approve</button><button class="btn-reject" onclick="reviewSubmission(\'' + s.id + '\',\'' + dealId + '\',\'rejected\')">&#10006; Request Changes</button></div>' : '')
          + (s.review_note ? '<div style="font-size:12px;color:#7B84A3;margin-top:8px;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.1)">' + esc(s.review_note) + '</div>' : '')
          + '</div>';
      }).join('');
    });
}

function reviewSubmission(subId, dealId, decision) {
  var note = decision === 'rejected' ? prompt('Reason for requesting changes:') : '';
  if (decision === 'rejected' && !note) return;
  zeke_sb.from('submissions').update({ status:decision, review_note:note||null, reviewed_at:new Date().toISOString() }).eq('id',subId)
    .then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      var msg = decision === 'approved' ? '✓ Content approved by ' + ZK.display_name : '⟳ Changes requested by ' + ZK.display_name + (note ? ': ' + note : '');
      return Promise.all([
        zeke_sb.from('deal_messages').insert({ deal_id:dealId, sender_id:ZK.id, msg_type:'event', content:msg }),
        decision === 'approved' ? zeke_sb.from('deals').update({status:'approved'}).eq('id',dealId) : Promise.resolve(),
        zeke_sb.from('deals').select('influencer_id,title').eq('id',dealId).single()
      ]);
    }).then(function (results) {
      if (results && results[2] && results[2].data) {
        var d = results[2].data;
        zeke_sb.from('notifications').insert({
          user_id: d.influencer_id,
          title: decision === 'approved' ? 'Content approved' : 'Changes requested',
          body:  decision === 'approved' ? d.title + ' — you can now submit the live link.' : (d.title + ' — ' + (note || 'Brand requested changes.')),
          type:  'deal'
        }).then(function () {});
      }
      _loadBrandReview(dealId, ''); _loadBrandTimeline(dealId);
    });
}

function _loadBrandPaymentPanel(dealId, deal) {
  var c = document.getElementById('brand-payment-content'); if (!c) return;
  zeke_sb.from('payments').select('*').eq('deal_id',dealId).maybeSingle()
    .then(function (r) {
      if (!r.data) {
        c.innerHTML = '<div style="background:#181C35;border:1px solid rgba(217,119,6,.25);border-radius:14px;padding:16px">'
          + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:12px">Mark Payment as Sent</div>'
          + '<div style="font-size:13px;color:#7B84A3;margin-bottom:16px">Agreed amount: <span style="color:#fff;font-weight:700">₹' + fmtNum(deal.amount||0) + '</span></div>'
          + '<button class="btn btn-primary btn-md btn-full" onclick="markPaymentSent(\'' + dealId + '\',' + (deal.amount||0) + ')">I have sent the payment</button></div>';
      } else {
        c.innerHTML = '<div style="background:#181C35;border:1px solid rgba(5,150,105,.25);border-radius:14px;padding:16px">'
          + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:12px">Payment Status</div>'
          + '<div style="background:#0B0D1A;border:1px solid rgba(5,150,105,.3);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px">'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:#fff">₹' + fmtNum(r.data.amount||0) + ' sent</div></div>'
          + '<span class="badge ' + (r.data.status==='confirmed' ? 'badge-green' : 'badge-gold') + '">' + (r.data.status==='confirmed' ? 'Confirmed by Creator' : 'Awaiting Confirmation') + '</span></div></div>';
      }
    });
}

function markPaymentSent(dealId, amount) {
  zeke_sb.from('payments').insert({ deal_id:dealId, amount:amount, sent_by:ZK.id, status:'pending', sent_at:new Date().toISOString() })
    .then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      return Promise.all([
        zeke_sb.from('deals').update({status:'payment_sent'}).eq('id',dealId),
        zeke_sb.from('deal_messages').insert({ deal_id:dealId, sender_id:ZK.id, msg_type:'event_gold', content:'₹ Payment of ₹' + fmtNum(amount) + ' sent by ' + ZK.display_name }),
        zeke_sb.from('deals').select('influencer_id,title').eq('id',dealId).single()
      ]);
    }).then(function (results) {
      if (results && results[2] && results[2].data) {
        var d = results[2].data;
        zeke_sb.from('notifications').insert({
          user_id: d.influencer_id,
          title: 'Payment sent',
          body: '₹' + fmtNum(amount) + ' has been sent for ' + d.title + '. Confirm receipt to close the deal.',
          type: 'payment'
        }).then(function () {});
      }
      zeke_sb.from('deals').select('*').eq('id',dealId).single().then(function (r) { if (r.data) _loadBrandPaymentPanel(dealId,r.data); });
    });
}

function _loadBrandAgreement(dealId) {
  var c = document.getElementById('brand-agreement-content'); if (!c) return;
  zeke_sb.from('agreements')
    .select('*, deals(title, amount, deliverables, platform, deadline, payment_terms, usage_rights, influencer_id, profiles!deals_influencer_id_fkey(display_name))')
    .eq('deal_id', dealId).maybeSingle()
    .then(function (r) {
      if (!r.data) {
        c.innerHTML = '<div style="background:#181C35;border:1px solid #252A45;border-radius:14px;padding:16px;opacity:.6"><div style="font-size:13px;font-weight:700;color:#fff">No Agreement Yet</div><div style="font-size:12px;color:#7B84A3;margin-top:6px">Generated automatically once the creator accepts the offer.</div></div>';
        return;
      }
      var a = r.data, d = a.deals || {};
      // Check if creator is Shield (PDF only for Shield)
      var creatorId = d.influencer_id;
      zeke_sb.from('influencer_profiles').select('shield_active').eq('id', creatorId).maybeSingle()
        .then(function (rr) {
          var shield = !!(rr && rr.data && rr.data.shield_active);
          var pdfBtn = shield
            ? '<button class="btn btn-outline btn-sm" style="flex:1" onclick="downloadBrandAgreementPDF(\'' + a.id + '\')">⬇ Download PDF</button>'
            : '<div style="font-size:11px;color:#7B84A3;text-align:center">PDF available when the creator is a Shield member.</div>';
          c.innerHTML = '<div class="item-card" style="border-color:rgba(5,150,105,.25)">'
            + '<div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:10px">Agreement</div>'
            + '<div style="background:#0B0D1A;border-radius:10px;padding:10px 14px;font-size:12px;color:#7B84A3;line-height:1.9;margin-bottom:12px">'
            + '<div><span style="color:#C8D0E7;font-weight:600">Title:</span> ' + esc(d.title||'') + '</div>'
            + '<div><span style="color:#C8D0E7;font-weight:600">Platform:</span> ' + esc(d.platform||'—') + '</div>'
            + '<div><span style="color:#C8D0E7;font-weight:600">Value:</span> ₹' + fmtNum(d.amount||0) + '</div>'
            + (d.deliverables ? '<div><span style="color:#C8D0E7;font-weight:600">Deliverables:</span> ' + esc(d.deliverables) + '</div>' : '')
            + '<div><span style="color:#C8D0E7;font-weight:600">Generated:</span> ' + fmtDate(a.generated_at) + '</div></div>'
            + '<div class="item-actions">' + pdfBtn + '</div></div>';
        });
    });
}

function downloadBrandAgreementPDF(agreementId) {
  if (!window.jspdf) { alert('PDF library failed to load. Please refresh.'); return; }
  zeke_sb.from('agreements')
    .select('*, deals(title, amount, deliverables, platform, deadline, payment_terms, usage_rights, profiles!deals_influencer_id_fkey(display_name))')
    .eq('id', agreementId).single()
    .then(function (r) {
      if (r.error || !r.data) { alert('Could not load agreement.'); return; }
      var a = r.data, d = a.deals || {};
      var creator = (d.profiles && d.profiles.display_name) || 'Creator';
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF();
      var y = 20;
      doc.setFont('helvetica','bold').setFontSize(20).text('ZEKE', 20, y); y += 8;
      doc.setFont('helvetica','normal').setFontSize(10).setTextColor(120).text('Legally Protected Influencer Marketplace', 20, y); y += 14;
      doc.setTextColor(0).setFontSize(14).setFont('helvetica','bold').text('Deal Agreement', 20, y); y += 10;
      doc.setFontSize(10).setFont('helvetica','normal');
      var lines = [
        ['Brand', ZK.display_name],
        ['Creator', creator],
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

// ── DISCOVER ──────────────────────────────────────────────
function loadAllCreators() {
  zeke_sb.from('influencer_profiles')
    .select('id,niche,ig_followers,yt_followers,x_followers,yt_enabled,x_enabled,rating,shield_active,handle,profiles!influencer_profiles_id_fkey(display_name,location)')
    .order('shield_active',{ascending:false})
    .order('ig_followers',{ascending:false})
    .then(function (r) { _allCreators = r.data||[]; filterCreators(); });
}

function filterCreators() {
  var q      = (document.getElementById('creator-search')  ? document.getElementById('creator-search').value  : '').toLowerCase();
  var niche  =  document.getElementById('niche-filter')    ? document.getElementById('niche-filter').value    : '';
  var shield = (document.getElementById('shield-filter')   ? document.getElementById('shield-filter').value   : '') === 'shield';
  var filtered = _allCreators.filter(function (c) {
    var name = (c.profiles&&c.profiles.display_name) ? c.profiles.display_name.toLowerCase() : '';
    var cn   = (c.niche||'').toLowerCase();
    return (!q || name.indexOf(q)!==-1 || cn.indexOf(q)!==-1) && (!niche || c.niche===niche) && (!shield || c.shield_active);
  });
  _renderCreatorGrid('creators-grid', filtered, true);
}

function _renderCreatorGrid(containerId, creators, expanded) {
  var c = document.getElementById(containerId); if (!c) return;
  if (!creators.length) { c.innerHTML = '<div class="empty-state">No creators found.</div>'; return; }
  c.innerHTML = creators.map(function (item) {
    var name     = (item.profiles&&item.profiles.display_name) ? item.profiles.display_name : 'Creator';
    var initials = name.slice(0,2).toUpperCase();
    var loc      = (item.profiles&&item.profiles.location) ? item.profiles.location : '';
    return '<div class="creator-card">'
      + '<div class="creator-card-top">'
      + '<div class="creator-avatar">' + initials + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px"><div style="font-size:14px;font-weight:700;color:#fff">' + esc(name) + '</div>'
      + (item.shield_active ? '<span style="color:#D97706;font-size:12px">&#128737;</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(item.handle ? '@'+item.handle : item.niche||'') + '</div></div>'
      + '<div style="text-align:right;flex-shrink:0">'
      + '<div style="font-size:14px;font-weight:700;color:#fff">' + fmtNum(item.ig_followers||0) + '</div>'
      + '<div style="font-size:12px;color:#D97706">&#9733; ' + (item.rating||'--') + '</div></div></div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc([item.niche,loc].filter(Boolean).join(' · ')) + '</div>'
      + (expanded ? '<div class="item-actions"><button class="btn btn-primary btn-sm" style="flex:1" onclick="openOfferModal(\'' + item.id + '\',\'' + esc(name) + '\')">Send Offer</button><button class="btn btn-outline btn-sm" onclick="openCreatorProfile(\'' + item.id + '\')">View Profile</button></div>' : '')
      + '</div>';
  }).join('');
}

// ── CAMPAIGN → OFFERS MODAL ───────────────────────────────
function openCampaignSendModal(campaignId) {
  zeke_sb.from('campaigns').select('*').eq('id', campaignId).single().then(function (cr) {
    if (cr.error || !cr.data) { alert('Campaign not found.'); return; }
    var camp = cr.data;
    var existing = document.getElementById('camp-send-modal'); if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'camp-send-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
    modal.innerHTML = ''
      + '<div style="background:#181C35;border:1px solid #252A45;border-radius:20px;padding:22px;width:100%;max-width:520px;max-height:92vh;display:flex;flex-direction:column;gap:14px">'
      + '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#fff">Send "' + esc(camp.title) + '"</div><div style="font-size:12px;color:#7B84A3">Pick creators to send this campaign as an offer.</div></div><button onclick="closeCampaignSendModal()" style="background:none;border:none;color:#7B84A3;font-size:22px;cursor:pointer">&times;</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
      +   '<input class="input-field no-icon" id="cs-platform" type="text" placeholder="Platform (e.g. Instagram Reel)" style="font-size:13px;padding:10px 14px">'
      +   '<select class="input-field no-icon" id="cs-niche-filter" onchange="_csFilter()" style="font-size:13px;padding:10px 14px">'
      +     '<option value="">All niches</option>'
      +     ['Lifestyle','Food & Cooking','Travel','Fashion & Beauty','Tech & Gadgets','Health & Fitness','Finance','Education','Entertainment','Gaming','Real Estate','Automotive','Parenting','Comedy / Meme','Business / Entrepreneurship'].map(function (n) {
            return '<option' + (camp.niche === n ? ' selected' : '') + '>' + esc(n) + '</option>';
          }).join('')
      +   '</select>'
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center">'
      +   '<input id="cs-search" type="text" oninput="_csFilter()" placeholder="Search creators..." style="flex:1;background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:8px 12px;font-size:13px;color:#C8D0E7;outline:none;font-family:Inter,sans-serif">'
      +   '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#7B84A3;cursor:pointer"><input type="checkbox" id="cs-shield-only" onchange="_csFilter()"> Shield only</label>'
      + '</div>'
      + '<div id="cs-creators-list" style="flex:1;overflow-y:auto;border:1px solid #252A45;border-radius:12px;background:#0B0D1A;max-height:42vh"><div class="empty-state" style="padding:20px">Loading...</div></div>'
      + '<div id="cs-error" class="error-msg hidden"></div>'
      + '<div style="display:flex;gap:10px;align-items:center"><div id="cs-summary" style="flex:1;font-size:12px;color:#7B84A3">0 selected · ₹' + fmtNum(camp.budget||0) + ' each</div>'
      +   '<button class="btn btn-outline btn-md" onclick="closeCampaignSendModal()">Cancel</button>'
      +   '<button class="btn btn-primary btn-md" id="cs-send-btn" onclick="submitCampaignOffers(\'' + campaignId + '\')">Send Offers</button>'
      + '</div></div>';
    document.body.appendChild(modal);
    _csCampaign = camp;
    _csCreators = [];
    _loadCsCreators();
  });
}

var _csCampaign = null;
var _csCreators = [];
var _csSelected = {};

function _loadCsCreators() {
  zeke_sb.from('influencer_profiles')
    .select('id,niche,ig_followers,shield_active,handle,profiles!influencer_profiles_id_fkey(display_name,location)')
    .order('shield_active', { ascending: false })
    .order('ig_followers', { ascending: false })
    .then(function (r) {
      _csCreators = r.data || [];
      _csFilter();
    });
}

function _csFilter() {
  var q      = (document.getElementById('cs-search')        || {}).value || '';
  var niche  = (document.getElementById('cs-niche-filter')  || {}).value || '';
  var shield = !!(document.getElementById('cs-shield-only') && document.getElementById('cs-shield-only').checked);
  q = q.toLowerCase();
  var filtered = _csCreators.filter(function (c) {
    var name = (c.profiles && c.profiles.display_name) ? c.profiles.display_name.toLowerCase() : '';
    var n    = (c.niche||'').toLowerCase();
    return (!q || name.indexOf(q) !== -1 || n.indexOf(q) !== -1)
        && (!niche || c.niche === niche)
        && (!shield || c.shield_active);
  });
  _csRender(filtered);
}

function _csRender(creators) {
  var c = document.getElementById('cs-creators-list'); if (!c) return;
  if (!creators.length) { c.innerHTML = '<div class="empty-state" style="padding:24px">No creators match.</div>'; return; }
  c.innerHTML = creators.map(function (item) {
    var name     = (item.profiles && item.profiles.display_name) || 'Creator';
    var loc      = (item.profiles && item.profiles.location)     || '';
    var initials = name.slice(0,2).toUpperCase();
    var checked  = _csSelected[item.id] ? 'checked' : '';
    return '<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #252A45;cursor:pointer" onclick="event.stopPropagation()">'
      + '<input type="checkbox" data-creator="' + item.id + '" ' + checked + ' onchange="_csToggle(\'' + item.id + '\',this.checked)" style="margin:0;width:16px;height:16px;accent-color:#E94560">'
      + '<div style="width:32px;height:32px;border-radius:50%;background:rgba(233,69,96,.15);color:#E94560;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">' + initials + '</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:13px;font-weight:700;color:#fff">' + esc(name) + (item.shield_active ? ' <span style="color:#D97706;font-size:11px">&#128737;</span>' : '') + '</div>'
      +   '<div style="font-size:11px;color:#7B84A3">' + esc([item.niche, loc].filter(Boolean).join(' · ')) + '</div>'
      + '</div>'
      + '<div style="text-align:right;flex-shrink:0;font-size:12px;color:#7B84A3">' + fmtNum(item.ig_followers||0) + '</div>'
      + '</label>';
  }).join('');
}

function _csToggle(id, on) {
  if (on) _csSelected[id] = true; else delete _csSelected[id];
  _csUpdateSummary();
}

function _csUpdateSummary() {
  var n = Object.keys(_csSelected).length;
  var amount = _csCampaign && _csCampaign.budget ? _csCampaign.budget : 0;
  var s = document.getElementById('cs-summary');
  if (s) s.textContent = n + ' selected · ₹' + fmtNum(amount) + ' each · ₹' + fmtNum(amount * n) + ' total';
}

function closeCampaignSendModal() {
  var m = document.getElementById('camp-send-modal'); if (m) m.remove();
  _csSelected = {}; _csCampaign = null; _csCreators = [];
}

function submitCampaignOffers(campaignId) {
  var ids = Object.keys(_csSelected);
  if (!ids.length) { showErr('cs-error', 'Pick at least one creator.'); return; }
  var platform = ((document.getElementById('cs-platform') || {}).value || '').trim();
  if (!platform) { showErr('cs-error', 'Enter the platform (e.g. Instagram Reel).'); return; }
  hideErr('cs-error');

  var camp = _csCampaign || {};
  var btn = document.getElementById('cs-send-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  var rows = ids.map(function (creatorId) {
    return {
      campaign_id:   campaignId,
      brand_id:      ZK.id,
      influencer_id: creatorId,
      title:         camp.title,
      platform:      platform,
      amount:        camp.budget || 0,
      deliverables:  camp.description || null,
      deadline:      camp.deadline || null,
      status:        'negotiating'
    };
  });

  zeke_sb.from('deals').insert(rows).select('id,influencer_id')
    .then(function (r) {
      if (r.error) { if (btn) { btn.disabled = false; btn.textContent = 'Send Offers'; } showErr('cs-error', r.error.message); return; }
      var inserted = r.data || [];
      var msgRows = inserted.map(function (d) { return { deal_id: d.id, sender_id: ZK.id, msg_type:'event', content: '📩 Offer sent by ' + ZK.display_name + ' · ' + camp.title + ' · ₹' + fmtNum(camp.budget||0) + ' · ' + platform }; });
      var notifRows = inserted.map(function (d) { return { user_id: d.influencer_id, title: 'New offer from ' + ZK.display_name, body: camp.title + ' · ₹' + fmtNum(camp.budget||0), type: 'deal' }; });
      Promise.all([
        msgRows.length   ? zeke_sb.from('deal_messages').insert(msgRows)     : Promise.resolve(),
        notifRows.length ? zeke_sb.from('notifications').insert(notifRows)   : Promise.resolve()
      ]).then(function () {
        closeCampaignSendModal();
        loadBrandDeals();
        alert('✓ Offer sent to ' + inserted.length + ' creator' + (inserted.length === 1 ? '' : 's') + '.');
      });
    });
}

// ── CREATOR PROFILE MODAL ─────────────────────────────────
function openCreatorProfile(influencerId) {
  zeke_sb.from('influencer_profiles')
    .select('*, profiles!influencer_profiles_id_fkey(display_name, location, created_at)')
    .eq('id', influencerId).single()
    .then(function (r) {
      if (r.error || !r.data) { alert('Could not load profile.'); return; }
      var inf = r.data, p = inf.profiles || {};
      var name = p.display_name || 'Creator';
      var initials = name.slice(0,2).toUpperCase();
      var existing = document.getElementById('creator-profile-modal'); if (existing) existing.remove();
      var modal = document.createElement('div');
      modal.id = 'creator-profile-modal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
      var avatarBg = inf.shield_active ? 'rgba(217,119,6,.2)' : 'rgba(233,69,96,.15)';
      var avatarBorder = inf.shield_active ? 'rgba(217,119,6,.4)' : 'rgba(233,69,96,.3)';
      var avatarColor = inf.shield_active ? '#D97706' : '#E94560';
      var shieldBadge = inf.shield_active
        ? '<span style="font-size:11px;font-weight:700;color:#D97706;background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.3);padding:3px 10px;border-radius:20px">🛡 Shield Member</span>'
        : '<span style="font-size:11px;font-weight:700;color:#7B84A3;background:rgba(123,132,163,.1);border:1px solid #252A45;padding:3px 10px;border-radius:20px">Free Creator</span>';
      var verifiedBadge = '';
      modal.innerHTML =
        '<div style="background:#181C35;border:1px solid #252A45;border-radius:20px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">'
        + '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">'
        + '<div style="width:56px;height:56px;border-radius:50%;background:' + avatarBg + ';border:2px solid ' + avatarBorder + ';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:' + avatarColor + ';flex-shrink:0">' + initials + '</div>'
        + '<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:900;color:#fff">' + esc(name) + '</div>'
        + '<div style="font-size:13px;color:#7B84A3">' + esc(inf.handle ? '@' + inf.handle.replace('@','') : '—') + ' · ' + esc(p.location || '') + '</div></div>'
        + '<button onclick="closeCreatorProfile()" style="background:none;border:none;color:#7B84A3;font-size:22px;cursor:pointer;line-height:1">&times;</button></div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">' + shieldBadge + verifiedBadge
        + '<span style="font-size:11px;font-weight:700;color:#7B84A3;background:rgba(123,132,163,.1);border:1px solid #252A45;padding:3px 10px;border-radius:20px">' + esc(inf.niche || 'Creator') + '</span></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
        + _platformStat('Instagram', inf.ig_followers, '#E94560', true)
        + _platformStat('YouTube',   inf.yt_followers, '#f87171', !!inf.yt_enabled)
        + _platformStat('Twitter/X', inf.x_followers,  '#38bdf8', !!inf.x_enabled)
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
        + '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#D97706">★ ' + (inf.rating || '—') + '</div><div style="font-size:10px;color:#7B84A3">Rating</div></div>'
        + '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div id="cprof-deals-count" style="font-size:14px;font-weight:900;color:#fff">…</div><div style="font-size:10px;color:#7B84A3">Completed deals</div></div>'
        + '</div>'
        + '<div style="display:flex;gap:10px">'
        + '<button class="btn btn-primary btn-md" style="flex:1" onclick="closeCreatorProfile();openOfferModal(\'' + inf.id + '\',\'' + esc(name) + '\')">Send Offer</button>'
        + '<button class="btn btn-outline btn-md" onclick="closeCreatorProfile()">Close</button>'
        + '</div></div>';
      document.body.appendChild(modal);
      zeke_sb.from('deals').select('id', { count:'exact', head:true }).eq('influencer_id', inf.id).eq('status', 'completed')
        .then(function (rr) { var el = document.getElementById('cprof-deals-count'); if (el) el.textContent = rr.count || 0; });
    });
}

function _platformStat(label, count, color, enabled) {
  if (!enabled) return '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45;opacity:.4"><div style="font-size:13px;color:#7B84A3">—</div><div style="font-size:10px;color:#7B84A3">' + label + '</div></div>';
  return '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:' + color + '">' + fmtNum(count || 0) + '</div><div style="font-size:10px;color:#7B84A3">' + label + '</div></div>';
}

function closeCreatorProfile() {
  var m = document.getElementById('creator-profile-modal'); if (m) m.remove();
}

// ── OFFER MODAL ───────────────────────────────────────────
function openOfferModal(influencerId, creatorName) {
  var existing = document.getElementById('offer-modal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'offer-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML =
    '<div style="background:#181C35;border:1px solid #252A45;border-radius:20px;padding:24px;width:100%;max-width:420px">'
    + '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">Send Offer</div>'
    + '<div style="font-size:12px;color:#7B84A3;margin-bottom:16px">To: ' + esc(creatorName) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + '<input class="input-field no-icon" id="offer-title" type="text" placeholder="Deal title (e.g. Eid Collection Reel)" style="font-size:13px;padding:10px 14px">'
    + '<input class="input-field no-icon" id="offer-platform" type="text" placeholder="Platform (e.g. Instagram Reel)" style="font-size:13px;padding:10px 14px">'
    + '<input class="input-field no-icon" id="offer-amount" type="number" placeholder="Offer amount in ₹" min="1" style="font-size:13px;padding:10px 14px">'
    + '<input class="input-field no-icon" id="offer-deliverables" type="text" placeholder="Deliverables (e.g. 1 Reel · 30-day usage)" style="font-size:13px;padding:10px 14px">'
    + '</div>'
    + '<div id="offer-error" class="error-msg hidden" style="margin-top:8px"></div>'
    + '<div style="display:flex;gap:10px;margin-top:16px">'
    + '<button class="btn btn-primary btn-md" style="flex:1" onclick="submitOffer(\'' + influencerId + '\')">Send Offer</button>'
    + '<button class="btn btn-outline btn-md" onclick="closeOfferModal()">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(modal);
}

function closeOfferModal() {
  var m = document.getElementById('offer-modal'); if (m) m.remove();
}

function submitOffer(influencerId) {
  var title  = (document.getElementById('offer-title')        ||{}).value.trim();
  var plat   = (document.getElementById('offer-platform')     ||{}).value.trim();
  var amount = parseFloat((document.getElementById('offer-amount') ||{}).value||'0');
  var deliv  = (document.getElementById('offer-deliverables') ||{}).value.trim();
  if (!title)            { showErr('offer-error','Enter a deal title.'); return; }
  if (!plat)             { showErr('offer-error','Enter the platform.'); return; }
  if (!amount || amount <= 0) { showErr('offer-error','Enter a valid amount.'); return; }
  hideErr('offer-error');

  zeke_sb.from('deals').insert({ brand_id:ZK.id, influencer_id:influencerId, title, amount, platform:plat, deliverables:deliv, status:'negotiating' })
    .select('id').single()
    .then(function (r) {
      if (r.error) { showErr('offer-error', r.error.message); return; }
      var dealId = r.data && r.data.id;
      if (dealId) {
        Promise.all([
          zeke_sb.from('deal_messages').insert({ deal_id:dealId, sender_id:ZK.id, msg_type:'event', content:'📩 Offer sent by ' + ZK.display_name + ' · ' + title + ' · ₹' + fmtNum(amount) + ' · ' + plat }),
          zeke_sb.from('notifications').insert({ user_id:influencerId, title:'New offer from ' + ZK.display_name, body:title+' · ₹'+fmtNum(amount), type:'deal' })
        ]);
      }
      closeOfferModal();
      loadBrandDeals();
    });
}

// ── PROFILE ───────────────────────────────────────────────
function _loadBrandDealHistory() {
  zeke_sb.from('deals').select('id,title,amount,status,profiles!deals_influencer_id_fkey(display_name)').eq('brand_id',ZK.id).order('updated_at',{ascending:false}).limit(3)
    .then(function (r) {
      var c = document.getElementById('brand-deal-history-inner'); if (!c) return;
      var rows = r.data||[];
      if (!rows.length) { c.innerHTML = '<div style="font-size:12px;color:#7B84A3">No deals yet.</div>'; return; }
      c.innerHTML = rows.map(function (d) {
        var creator = (d.profiles&&d.profiles.display_name)||'Creator';
        var si = _si(d.status);
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #252A45">'
          + '<div><div style="font-size:12px;font-weight:600;color:#fff">' + esc(creator) + '</div>'
          + '<div style="font-size:11px;color:#7B84A3">' + esc(d.title||'') + '</div></div>'
          + '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:' + si.color + '">₹' + fmtNum(d.amount||0) + '</div>'
          + '<div style="font-size:10px;color:#7B84A3">' + si.label + '</div></div></div>';
      }).join('');
    });
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function loadBrandNotifications() {
  zeke_sb.from('notifications').select('*').eq('user_id',ZK.id).order('created_at',{ascending:false}).limit(10)
    .then(function (r) {
      var inner = document.getElementById('notif-panel-inner'); if (!inner) return;
      var notifs = r.data||[];
      var dot = document.getElementById('main-notif-dot');
      if (dot) dot.style.display = notifs.some(function(n){return !n.read;}) ? 'block' : 'none';
      var header = '<div class="notif-header"><div class="notif-title">Notifications</div><button class="notif-clear" onclick="clearNotifs()">Mark all read</button></div>';
      if (!notifs.length) { inner.innerHTML = header + '<div style="padding:20px;text-align:center;font-size:13px;color:#7B84A3">No notifications yet.</div>'; return; }
      inner.innerHTML = header + notifs.map(function (n) {
        return '<div class="notif-item' + (!n.read?' unread':'') + '">'
          + '<div class="notif-icon" style="background:rgba(233,69,96,.12);color:#E94560"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>'
          + '<div class="notif-body"><div class="notif-body-title">' + esc(n.title) + '</div><div class="notif-body-sub">' + esc(n.body||'') + '</div></div>'
          + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div class="notif-time">' + fmtDate(n.created_at) + '</div>'
          + (!n.read ? '<div class="notif-unread-dot"></div>' : '') + '</div></div>';
      }).join('');
    });
}

function subscribeToNotifications() {
  zeke_sb.channel('brand-notifs:' + ZK.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+ZK.id},
      function () { loadBrandNotifications(); })
    .subscribe();
}

// ── UTILS ─────────────────────────────────────────────────
function _si(status) {
  var map = {
    completed:    { label:'Paid',        color:'#059669', bg:'rgba(5,150,105,.03)',   border:'rgba(5,150,105,.3)',   badge:'badge-green'  },
    active:       { label:'Active',      color:'#E94560', bg:'rgba(233,69,96,.03)',   border:'rgba(233,69,96,.3)',   badge:'badge-accent' },
    negotiating:  { label:'Offer',       color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    submitted:    { label:'Reviewing',   color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    approved:     { label:'Approved',    color:'#059669', bg:'rgba(5,150,105,.03)',   border:'rgba(5,150,105,.3)',   badge:'badge-green'  },
    link_submitted:{ label:'Link Sent', color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    payment_sent: { label:'Paying',      color:'#D97706', bg:'rgba(217,119,6,.03)',   border:'rgba(217,119,6,.3)',   badge:'badge-gold'   },
    cancelled:    { label:'Cancelled',   color:'#7B84A3', bg:'rgba(123,132,163,.03)', border:'rgba(123,132,163,.3)', badge:'badge-muted'  },
    disputed:     { label:'Disputed',    color:'#E94560', bg:'rgba(233,69,96,.03)',   border:'rgba(233,69,96,.3)',   badge:'badge-accent' }
  };
  return map[status] || map.negotiating;
}

function _set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts), diff = Math.floor((new Date()-d)/60000);
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff/60) + 'h ago';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

function fmtDateShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('zeke:ready', function () {
  populateBrandUI();
  loadBrandNotifications();
  subscribeToNotifications();
  // Resume on the tab the user was on (URL hash) — defaults to overview.
  var initial = (window.location.hash || '').replace('#','');
  if (!initial || ['overview','campaigns','chats','deals','discover','profile'].indexOf(initial) === -1) initial = 'overview';
  bSwitchTab(initial);
  bSetMob(initial);
});
