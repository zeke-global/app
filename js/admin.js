/* ═══════════════════════════════════════
   ZEKE — ADMIN JS
   Requires session.js → window.ZK ready
═══════════════════════════════════════ */

function aSwitchTab(tab) {
  ['overview','shield','disputes','deals'].forEach(function (t) {
    var el  = document.getElementById('atab-' + t);     if (el)  el.classList.toggle('hidden', t !== tab);
    var btn = document.getElementById('admin-tab-' + t); if (btn) btn.className = 'sidebar-nav-btn' + (t === tab ? ' active-tab' : '');
  });
  if (tab === 'disputes') loadDisputes();
  if (tab === 'deals')    loadAllDeals();
  if (tab === 'shield')   loadShieldRequests();
}

function aSetMob(tab) {
  ['overview','shield','disputes','deals'].forEach(function (t) {
    var b = document.getElementById('amob-' + t); if (b) b.className = 'mob-nav-btn' + (t === tab ? ' active' : '');
  });
}

// ── OVERVIEW ──────────────────────────────────────────────
function loadAdminOverview() {
  zeke_sb.from('profiles').select('id', { count:'exact', head:true })
    .then(function (r) { _set('astat-users', r.count || 0); });

  zeke_sb.from('deals').select('id', { count:'exact', head:true })
    .not('status','in','("completed","cancelled")')
    .then(function (r) { _set('astat-deals', r.count || 0); });

  zeke_sb.from('influencer_profiles').select('id', { count:'exact', head:true })
    .eq('shield_active', true)
    .then(function (r) { _set('astat-shield', r.count || 0); });

  zeke_sb.from('disputes').select('id', { count:'exact', head:true })
    .eq('status','open')
    .then(function (r) {
      _set('astat-disputes', r.count || 0);
      _set('astat-disputes-open', r.count || 0);
    });

  zeke_sb.from('shield_requests').select('id', { count:'exact', head:true })
    .eq('status', 'pending')
    .then(function (r) { _set('astat-shield-pending', r.count || 0); });

  loadRecentDealsPreview();
}

function loadRecentDealsPreview() {
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,profiles!deals_brand_id_fkey(display_name),creator:profiles!deals_influencer_id_fkey(display_name)')
    .order('updated_at',{ascending:false}).limit(5)
    .then(function (r) { _renderDealsTable('recent-deals', r.data || []); });
}

// ── DEALS ─────────────────────────────────────────────────
function loadAllDeals() {
  zeke_sb.from('deals')
    .select('id,title,platform,amount,status,created_at,profiles!deals_brand_id_fkey(display_name),creator:profiles!deals_influencer_id_fkey(display_name)')
    .order('created_at',{ascending:false})
    .then(function (r) {
      var rows = r.data || [];
      var ct = document.getElementById('all-deals-count');
      if (ct) ct.textContent = rows.length + ' total';
      _renderDealsTable('all-deals', rows);
    });
}

function _renderDealsTable(containerId, deals) {
  var c = document.getElementById(containerId); if (!c) return;
  if (!deals.length) { c.innerHTML = '<div class="empty-state">No deals yet.</div>'; return; }
  var statusMap = {
    active:       { label:'Active',     cls:'badge-green'  },
    completed:    { label:'Completed',  cls:'badge-muted'  },
    negotiating:  { label:'Offer',      cls:'badge-gold'   },
    submitted:    { label:'Reviewing',  cls:'badge-gold'   },
    disputed:     { label:'Disputed',   cls:'badge-accent' },
    cancelled:    { label:'Cancelled',  cls:'badge-muted'  },
    payment_sent: { label:'Paying',     cls:'badge-gold'   }
  };
  c.innerHTML = deals.map(function (d) {
    var brand   = (d.profiles && d.profiles.display_name) ? d.profiles.display_name   : 'Brand';
    var creator = (d.creator  && d.creator.display_name)  ? d.creator.display_name    : 'Creator';
    var s = statusMap[d.status] || { label: d.status, cls:'badge-muted' };
    return '<div class="item-card" style="margin-bottom:8px;flex-direction:row;align-items:center;gap:12px;padding:14px 16px">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:14px;color:#fff;font-weight:500">' + esc(creator) + ' × ' + esc(brand) + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + esc(d.platform||'') + '</div></div>'
      + '<div style="font-size:14px;font-weight:900;color:#fff;flex-shrink:0">₹' + fmtNum(d.amount||0) + '</div>'
      + '<span class="badge ' + s.cls + '">' + s.label + '</span></div>';
  }).join('');
}

// ── SHIELD REQUESTS ───────────────────────────────────────
function loadShieldRequests() {
  zeke_sb.from('shield_requests')
    .select('*, profiles!shield_requests_influencer_id_fkey(display_name, location)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .then(function (r) {
      var c = document.getElementById('shield-list'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) {
        c.innerHTML = '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>No pending Shield requests.</span></div>';
        return;
      }
      c.innerHTML = rows.map(function (s) {
        var p = s.profiles || {};
        var name = p.display_name || 'Creator';
        var initials = name.slice(0,2).toUpperCase();
        return '<div class="item-card" style="margin-bottom:12px">'
          + '<div class="item-card-header">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div class="item-avatar" style="background:rgba(217,119,6,.15);color:#D97706">' + initials + '</div>'
          + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(name) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">' + esc(p.location||'') + ' · Requested ' + fmtDate(s.requested_at) + '</div></div></div>'
          + '<div style="text-align:right"><div style="font-size:14px;font-weight:900;color:#D97706">₹' + (s.amount||1999) + '</div>'
          + '<span class="badge badge-gold" style="margin-top:4px">Pending</span></div></div>'
          + '<div class="item-actions">'
          + '<button class="btn-approve" onclick="activateShield(\'' + s.id + '\',\'' + s.influencer_id + '\',this)">&#128737; Activate</button>'
          + '<button class="btn-reject"  onclick="rejectShield(\''   + s.id + '\',\'' + s.influencer_id + '\',this)">&#10006; Reject</button>'
          + '</div></div>';
      }).join('');
    });
}

function activateShield(reqId, influencerId, btn) {
  if (!confirm('Confirm payment received and activate Shield for this creator?')) return;
  btn.disabled = true; btn.textContent = 'Activating...';
  var oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1);
  var expires = oneYear.toISOString().slice(0,10);
  Promise.all([
    zeke_sb.from('shield_requests').update({ status:'activated', activated_at: new Date().toISOString(), expires_at: expires }).eq('id', reqId),
    zeke_sb.from('influencer_profiles').update({ shield_active: true, shield_expires: expires }).eq('id', influencerId),
    zeke_sb.from('notifications').insert({ user_id: influencerId, title: '🛡 Shield Activated', body: 'Your Zeke Shield is active until ' + expires + '. Welcome to the Shield circle.', type: 'system' })
  ]).then(function () { loadShieldRequests(); loadAdminOverview(); });
}

function rejectShield(reqId, influencerId, btn) {
  var reason = prompt('Reason (shown to creator):');
  if (!reason) return;
  btn.disabled = true;
  Promise.all([
    zeke_sb.from('shield_requests').update({ status:'rejected', note: reason }).eq('id', reqId),
    zeke_sb.from('notifications').insert({ user_id: influencerId, title: 'Shield request not approved', body: reason, type: 'system' })
  ]).then(function () { loadShieldRequests(); loadAdminOverview(); });
}

// ── DISPUTES ──────────────────────────────────────────────
function loadDisputes() {
  zeke_sb.from('disputes')
    .select('*,deals(id,title,amount,profiles!deals_brand_id_fkey(display_name),creator:profiles!deals_influencer_id_fkey(display_name)),raiser:profiles!disputes_raised_by_fkey(display_name)')
    .eq('status','open').order('created_at',{ascending:false})
    .then(function (r) {
      var c = document.getElementById('disputes-list'); if (!c) return;
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No open disputes.</div>'; return; }
      c.innerHTML = rows.map(function (dis) {
        var deal    = dis.deals || {};
        var brand   = (deal.profiles && deal.profiles.display_name)  ? deal.profiles.display_name  : 'Brand';
        var creator = (deal.creator  && deal.creator.display_name)   ? deal.creator.display_name   : 'Creator';
        var raiser  = (dis.raiser    && dis.raiser.display_name)     ? dis.raiser.display_name      : 'User';
        return '<div class="item-card" style="margin-bottom:12px">'
          + '<div class="item-card-header"><div>'
          + '<div style="font-size:14px;font-weight:700;color:#fff">' + esc(creator) + ' × ' + esc(brand) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">Raised by ' + esc(raiser) + ' · ' + fmtDate(dis.created_at) + '</div></div>'
          + '<span class="badge badge-accent">Open</span></div>'
          + '<div style="font-size:13px;color:#C8D0E7;line-height:1.6">' + esc(dis.reason) + '</div>'
          + '<div class="item-actions">'
          + '<button class="btn-approve" onclick="resolveDispute(\'' + dis.id + '\',this)">&#10003; Resolve</button>'
          + '<button class="btn-reject"  onclick="escalateDispute(\'' + dis.id + '\',this)">&#10006; Escalate</button>'
          + '</div></div>';
      }).join('');
    });
}

function resolveDispute(disputeId, btn) {
  var resolution = prompt('Resolution note:'); if (!resolution) return;
  btn.disabled = true;
  zeke_sb.from('disputes').update({ status:'resolved', resolution: resolution, resolved_at: new Date().toISOString() }).eq('id', disputeId)
    .then(function (r) {
      btn.disabled = false;
      if (r.error) { alert(r.error.message); return; }
      loadDisputes(); loadAdminOverview();
    });
}

function escalateDispute(disputeId, btn) {
  btn.disabled = true;
  zeke_sb.from('disputes').update({ status:'escalated' }).eq('id', disputeId)
    .then(function (r) {
      btn.disabled = false;
      if (r.error) { alert(r.error.message); return; }
      loadDisputes();
    });
}

// ── NOTIFICATIONS ─────────────────────────────────────────
function loadAdminNotifications() {
  if (!window.ZK) return;
  zeke_sb.from('notifications').select('*').eq('user_id', ZK.id).order('created_at',{ascending:false}).limit(10)
    .then(function (r) {
      var inner = document.getElementById('notif-panel-inner'); if (!inner) return;
      var header = '<div class="notif-header"><div class="notif-title">Notifications</div><button class="notif-clear" onclick="clearNotifs()">Mark all read</button></div>';
      var notifs = r.data || [];
      if (!notifs.length) { inner.innerHTML = header + '<div style="padding:20px;text-align:center;font-size:13px;color:#7B84A3">No notifications.</div>'; return; }
      inner.innerHTML = header + notifs.map(function (n) {
        return '<div class="notif-item' + (!n.read ? ' unread' : '') + '">'
          + '<div class="notif-icon" style="background:rgba(233,69,96,.12);color:#E94560"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>'
          + '<div class="notif-body"><div class="notif-body-title">' + esc(n.title) + '</div><div class="notif-body-sub">' + esc(n.body||'') + '</div></div>'
          + '<div class="notif-time">' + fmtDate(n.created_at) + '</div></div>';
      }).join('');
    });
}

// ── UTILS ─────────────────────────────────────────────────
function _set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function fmtDate(ts) {
  if (!ts) return '';
  var d = new Date(ts), diff = Math.floor((new Date() - d) / 60000);
  if (diff < 1)    return 'Just now';
  if (diff < 60)   return diff + 'm ago';
  if (diff < 1440) return Math.floor(diff/60) + 'h ago';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── BOOT ──────────────────────────────────────────────────
document.addEventListener('zeke:ready', function () {
  loadAdminOverview();
  loadAdminNotifications();
});
