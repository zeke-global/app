/* ═══════════════════════════════════════
   ZEKE — ADMIN JS
   Requires session.js → window.ZK ready
═══════════════════════════════════════ */

function aSwitchTab(tab) {
  ['overview','users','shield','disputes','deals'].forEach(function (t) {
    var el  = document.getElementById('atab-' + t);     if (el)  el.classList.toggle('hidden', t !== tab);
    var btn = document.getElementById('admin-tab-' + t); if (btn) btn.className = 'sidebar-nav-btn' + (t === tab ? ' active-tab' : '');
  });
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '#' + tab);
  }
  if (tab === 'overview') loadAdminOverview();
  if (tab === 'users')    usersSubTab(_usersSub);
  if (tab === 'shield')   loadShieldRequests();
  if (tab === 'disputes') loadDisputes();
  if (tab === 'deals')    loadAllDeals();
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
    return '<div class="item-card" style="margin-bottom:8px;flex-direction:row;align-items:center;gap:12px;padding:14px 16px;cursor:pointer" onclick="openAdminDealDetail(\'' + d.id + '\')">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:14px;color:#fff;font-weight:500">' + esc(creator) + ' × ' + esc(brand) + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(d.title||'') + ' · ' + esc(d.platform||'') + '</div></div>'
      + '<div style="font-size:14px;font-weight:900;color:#fff;flex-shrink:0">₹' + fmtNum(d.amount||0) + '</div>'
      + '<span class="badge ' + s.cls + '">' + s.label + '</span></div>';
  }).join('');
}

// ── USERS DIRECTORY ───────────────────────────────────────
var _usersSub = 'brands';

function usersSubTab(sub) {
  _usersSub = sub;
  var bb = document.getElementById('users-tab-brands');
  var cb = document.getElementById('users-tab-creators');
  if (bb) bb.className = 'btn btn-sm ' + (sub === 'brands'   ? 'btn-primary' : 'btn-outline');
  if (cb) cb.className = 'btn btn-sm ' + (sub === 'creators' ? 'btn-primary' : 'btn-outline');
  if (sub === 'brands')   loadBrandsDirectory();
  if (sub === 'creators') loadCreatorsDirectory();
}

function loadBrandsDirectory() {
  var c = document.getElementById('users-list'); if (!c) return;
  c.innerHTML = '<div class="empty-state">Loading...</div>';
  zeke_sb.from('brand_profiles')
    .select('id,brand_type,profiles!brand_profiles_id_fkey(display_name,location,created_at)')
    .then(function (r) {
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No brands yet.</div>'; return; }
      // Pull deal stats per brand in parallel
      Promise.all(rows.map(function (b) {
        return zeke_sb.from('deals').select('amount,status').eq('brand_id', b.id).then(function (rr) {
          var deals = rr.data || [];
          return {
            id: b.id,
            type: b.brand_type || 'business',
            name: (b.profiles && b.profiles.display_name) || 'Brand',
            location: (b.profiles && b.profiles.location) || '',
            joined: (b.profiles && b.profiles.created_at) || null,
            dealsTotal: deals.length,
            dealsCompleted: deals.filter(function (d) { return d.status === 'completed'; }).length,
            spent: deals.filter(function (d) { return d.status === 'completed'; }).reduce(function (s, d) { return s + (d.amount || 0); }, 0)
          };
        });
      })).then(function (brands) {
        c.innerHTML = brands.map(function (b) {
          var initials = b.name.slice(0,2).toUpperCase();
          var typeLabel = b.type.charAt(0).toUpperCase() + b.type.slice(1);
          return '<div class="item-card" style="margin-bottom:8px;flex-direction:row;align-items:center;gap:12px;padding:14px 16px;cursor:pointer" onclick="openAdminBrandProfile(\'' + b.id + '\')">'
            + '<div class="item-avatar" style="background:rgba(15,52,96,.5);color:#C8D0E7">' + initials + '</div>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:14px;font-weight:700;color:#fff">' + esc(b.name) + '</div>'
            +   '<div style="font-size:12px;color:#7B84A3">' + esc(typeLabel) + (b.location ? ' · ' + esc(b.location) : '') + ' · Joined ' + fmtDate(b.joined) + '</div>'
            + '</div>'
            + '<div style="text-align:right;flex-shrink:0">'
            +   '<div style="font-size:13px;font-weight:700;color:#fff">' + b.dealsTotal + ' deal' + (b.dealsTotal === 1 ? '' : 's') + '</div>'
            +   '<div style="font-size:11px;color:#059669">₹' + fmtNum(b.spent) + ' spent</div>'
            + '</div></div>';
        }).join('');
      });
    });
}

function loadCreatorsDirectory() {
  var c = document.getElementById('users-list'); if (!c) return;
  c.innerHTML = '<div class="empty-state">Loading...</div>';
  zeke_sb.from('influencer_profiles')
    .select('id,niche,handle,ig_followers,shield_active,rating,profiles!influencer_profiles_id_fkey(display_name,location,created_at)')
    .order('shield_active', { ascending: false })
    .order('ig_followers',  { ascending: false })
    .then(function (r) {
      var rows = r.data || [];
      if (!rows.length) { c.innerHTML = '<div class="empty-state">No creators yet.</div>'; return; }
      Promise.all(rows.map(function (cr) {
        return zeke_sb.from('deals').select('amount,status').eq('influencer_id', cr.id).then(function (rr) {
          var deals = rr.data || [];
          return {
            row: cr,
            dealsCompleted: deals.filter(function (d) { return d.status === 'completed'; }).length,
            earned: deals.filter(function (d) { return d.status === 'completed'; }).reduce(function (s, d) { return s + (d.amount || 0); }, 0)
          };
        });
      })).then(function (creators) {
        c.innerHTML = creators.map(function (k) {
          var cr = k.row;
          var name = (cr.profiles && cr.profiles.display_name) || 'Creator';
          var loc  = (cr.profiles && cr.profiles.location) || '';
          var initials = name.slice(0,2).toUpperCase();
          var shieldChip = cr.shield_active
            ? '<span class="badge badge-gold" style="margin-top:4px">🛡 Shield</span>'
            : '<span class="badge badge-muted" style="margin-top:4px">Free</span>';
          return '<div class="item-card" style="margin-bottom:8px;flex-direction:row;align-items:center;gap:12px;padding:14px 16px;cursor:pointer" onclick="openAdminCreatorProfile(\'' + cr.id + '\')">'
            + '<div class="item-avatar">' + initials + '</div>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:14px;font-weight:700;color:#fff">' + esc(name) + '</div>'
            +   '<div style="font-size:12px;color:#7B84A3">' + esc(cr.niche || '') + (cr.handle ? ' · @' + esc(cr.handle) : '') + (loc ? ' · ' + esc(loc) : '') + '</div>'
            +   '<div style="font-size:11px;color:#7B84A3">IG ' + fmtNum(cr.ig_followers || 0) + ' · Joined ' + fmtDate(cr.profiles && cr.profiles.created_at) + '</div>'
            + '</div>'
            + '<div style="text-align:right;flex-shrink:0">'
            +   '<div style="font-size:13px;font-weight:700;color:#fff">' + k.dealsCompleted + ' deal' + (k.dealsCompleted === 1 ? '' : 's') + '</div>'
            +   '<div style="font-size:11px;color:#059669">₹' + fmtNum(k.earned) + ' earned</div>'
            +   shieldChip
            + '</div></div>';
        }).join('');
      });
    });
}

// ── ADMIN PROFILE MODALS ──────────────────────────────────
function _adminCloseModal() {
  var m = document.getElementById('admin-profile-modal'); if (m) m.remove();
}

function _adminOpenModalShell(html) {
  _adminCloseModal();
  var modal = document.createElement('div');
  modal.id = 'admin-profile-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  modal.onclick = function (e) { if (e.target === modal) _adminCloseModal(); };
  modal.innerHTML = '<div style="background:#181C35;border:1px solid #252A45;border-radius:20px;padding:22px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto">' + html + '</div>';
  document.body.appendChild(modal);
}

function openAdminBrandProfile(brandId) {
  Promise.all([
    zeke_sb.from('brand_profiles').select('*, profiles!brand_profiles_id_fkey(display_name,location,created_at)').eq('id', brandId).single(),
    zeke_sb.from('campaigns').select('id,title,niche,budget,deadline,status,created_at').eq('brand_id', brandId).order('created_at', { ascending: false }),
    zeke_sb.from('deals').select('id,title,amount,status,profiles!deals_influencer_id_fkey(display_name)').eq('brand_id', brandId).order('updated_at', { ascending: false })
  ]).then(function (res) {
    var br = res[0].data;
    if (!br) { alert('Brand not found.'); return; }
    var p = br.profiles || {};
    var camps = res[1].data || [];
    var deals = res[2].data || [];
    var spent = deals.filter(function (d) { return d.status === 'completed'; }).reduce(function (s, d) { return s + (d.amount||0); }, 0);
    var name = p.display_name || 'Brand';
    var initials = name.slice(0,2).toUpperCase();
    var typeLabel = (br.brand_type || 'business').replace(/^./, function (c) { return c.toUpperCase(); });
    var html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'
      + '<div style="width:48px;height:48px;border-radius:50%;background:rgba(15,52,96,.5);color:#C8D0E7;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900">' + initials + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:900;color:#fff">' + esc(name) + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(typeLabel) + (p.location ? ' · ' + esc(p.location) : '') + ' · Joined ' + fmtDate(p.created_at) + '</div></div>'
      + '<button onclick="_adminCloseModal()" style="background:none;border:none;color:#7B84A3;font-size:22px;cursor:pointer">&times;</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#fff">' + camps.length + '</div><div style="font-size:10px;color:#7B84A3">Campaigns</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#fff">' + deals.length + '</div><div style="font-size:10px;color:#7B84A3">Deals</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#059669">₹' + fmtNum(spent) + '</div><div style="font-size:10px;color:#7B84A3">Spent</div></div>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:#C8D0E7;margin:14px 0 8px">Campaigns</div>'
      + (camps.length ? camps.map(function (c) {
          return '<div style="background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px">'
            + '<div style="flex:1;min-width:0"><div style="font-size:13px;color:#fff;font-weight:600">' + esc(c.title) + '</div>'
            + '<div style="font-size:11px;color:#7B84A3">' + esc(c.niche||'') + ' · ' + (c.deadline ? 'Due ' + esc(c.deadline) : '') + '</div></div>'
            + '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:#D97706">₹' + fmtNum(c.budget||0) + '</div>'
            + '<span class="badge ' + (c.status === 'active' ? 'badge-green' : 'badge-muted') + '">' + esc(c.status) + '</span></div></div>';
        }).join('') : '<div style="font-size:12px;color:#7B84A3">No campaigns yet.</div>')
      + '<div style="font-size:12px;font-weight:700;color:#C8D0E7;margin:14px 0 8px">Deals</div>'
      + (deals.length ? deals.map(function (d) {
          var creator = (d.profiles && d.profiles.display_name) || 'Creator';
          return '<div style="background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openAdminDealDetail(\'' + d.id + '\')">'
            + '<div style="flex:1;min-width:0"><div style="font-size:13px;color:#fff;font-weight:600">' + esc(d.title || '') + '</div>'
            + '<div style="font-size:11px;color:#7B84A3">with ' + esc(creator) + '</div></div>'
            + '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:#fff">₹' + fmtNum(d.amount||0) + '</div>'
            + '<span class="badge badge-muted">' + esc(d.status) + '</span></div></div>';
        }).join('') : '<div style="font-size:12px;color:#7B84A3">No deals yet.</div>');
    _adminOpenModalShell(html);
  });
}

function openAdminCreatorProfile(creatorId) {
  Promise.all([
    zeke_sb.from('influencer_profiles').select('*, profiles!influencer_profiles_id_fkey(display_name,location,created_at)').eq('id', creatorId).single(),
    zeke_sb.from('deals').select('id,title,amount,status,profiles!deals_brand_id_fkey(display_name)').eq('influencer_id', creatorId).order('updated_at', { ascending: false })
  ]).then(function (res) {
    var inf = res[0].data;
    if (!inf) { alert('Creator not found.'); return; }
    var p = inf.profiles || {};
    var deals = res[1].data || [];
    var earned = deals.filter(function (d) { return d.status === 'completed'; }).reduce(function (s, d) { return s + (d.amount||0); }, 0);
    var name = p.display_name || 'Creator';
    var initials = name.slice(0,2).toUpperCase();
    var avatarBg = inf.shield_active ? 'rgba(217,119,6,.2)' : 'rgba(233,69,96,.15)';
    var avatarColor = inf.shield_active ? '#D97706' : '#E94560';
    var html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'
      + '<div style="width:48px;height:48px;border-radius:50%;background:' + avatarBg + ';color:' + avatarColor + ';display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900">' + initials + '</div>'
      + '<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:900;color:#fff">' + esc(name) + (inf.shield_active ? ' <span style="color:#D97706;font-size:13px">🛡</span>' : '') + '</div>'
      + '<div style="font-size:12px;color:#7B84A3">' + esc(inf.niche || '') + (inf.handle ? ' · @' + esc(inf.handle) : '') + (p.location ? ' · ' + esc(p.location) : '') + '</div>'
      + '<div style="font-size:11px;color:#7B84A3">Joined ' + fmtDate(p.created_at) + '</div></div>'
      + '<button onclick="_adminCloseModal()" style="background:none;border:none;color:#7B84A3;font-size:22px;cursor:pointer">&times;</button></div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">'
      +   _platformTile('Instagram', inf.ig_followers, '#E94560', true)
      +   _platformTile('YouTube',   inf.yt_followers, '#f87171', !!inf.yt_enabled)
      +   _platformTile('Twitter/X', inf.x_followers,  '#38bdf8', !!inf.x_enabled)
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#fff">' + deals.length + '</div><div style="font-size:10px;color:#7B84A3">Deals</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#059669">₹' + fmtNum(earned) + '</div><div style="font-size:10px;color:#7B84A3">Earned</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#D97706">★ ' + (inf.rating || '—') + '</div><div style="font-size:10px;color:#7B84A3">Rating</div></div>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:#C8D0E7;margin:14px 0 8px">Deals</div>'
      + (deals.length ? deals.map(function (d) {
          var brand = (d.profiles && d.profiles.display_name) || 'Brand';
          return '<div style="background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openAdminDealDetail(\'' + d.id + '\')">'
            + '<div style="flex:1;min-width:0"><div style="font-size:13px;color:#fff;font-weight:600">' + esc(d.title || '') + '</div>'
            + '<div style="font-size:11px;color:#7B84A3">with ' + esc(brand) + '</div></div>'
            + '<div style="text-align:right"><div style="font-size:12px;font-weight:700;color:#fff">₹' + fmtNum(d.amount||0) + '</div>'
            + '<span class="badge badge-muted">' + esc(d.status) + '</span></div></div>';
        }).join('') : '<div style="font-size:12px;color:#7B84A3">No deals yet.</div>');
    _adminOpenModalShell(html);
  });
}

function _platformTile(label, count, color, enabled) {
  if (!enabled) return '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45;opacity:.4"><div style="font-size:13px;color:#7B84A3">—</div><div style="font-size:10px;color:#7B84A3">' + label + '</div></div>';
  return '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:' + color + '">' + fmtNum(count || 0) + '</div><div style="font-size:10px;color:#7B84A3">' + label + '</div></div>';
}

function openAdminDealDetail(dealId) {
  Promise.all([
    zeke_sb.from('deals').select('*, brand:profiles!deals_brand_id_fkey(display_name), creator:profiles!deals_influencer_id_fkey(display_name)').eq('id', dealId).single(),
    zeke_sb.from('deal_messages').select('msg_type,content,created_at').eq('deal_id', dealId).in('msg_type', ['event','event_gold']).order('created_at', { ascending: true })
  ]).then(function (res) {
    var d = res[0].data;
    if (!d) { alert('Deal not found.'); return; }
    var events = res[1].data || [];
    var brand   = (d.brand && d.brand.display_name) || 'Brand';
    var creator = (d.creator && d.creator.display_name) || 'Creator';
    var html = '<div style="display:flex;align-items:start;gap:12px;margin-bottom:14px">'
      + '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:#fff">' + esc(brand) + ' × ' + esc(creator) + '</div>'
      + '<div style="font-size:13px;color:#7B84A3">' + esc(d.title || '') + (d.platform ? ' · ' + esc(d.platform) : '') + '</div></div>'
      + '<button onclick="_adminCloseModal()" style="background:none;border:none;color:#7B84A3;font-size:22px;cursor:pointer">&times;</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#D97706">₹' + fmtNum(d.amount||0) + '</div><div style="font-size:10px;color:#7B84A3">Value</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:14px;font-weight:900;color:#fff">' + esc(d.status) + '</div><div style="font-size:10px;color:#7B84A3">Status</div></div>'
      +   '<div style="text-align:center;padding:10px;background:#0B0D1A;border-radius:10px;border:1px solid #252A45"><div style="font-size:13px;font-weight:700;color:#fff">' + (d.deadline || '—') + '</div><div style="font-size:10px;color:#7B84A3">Deadline</div></div>'
      + '</div>'
      + (d.deliverables ? '<div style="background:#0B0D1A;border:1px solid #252A45;border-radius:10px;padding:10px 12px;margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#7B84A3;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Deliverables</div><div style="font-size:13px;color:#C8D0E7;line-height:1.6">' + esc(d.deliverables) + '</div></div>' : '')
      + '<div style="font-size:12px;font-weight:700;color:#C8D0E7;margin-bottom:8px">Timeline</div>'
      + (events.length
          ? events.map(function (ev) {
              var c = ev.msg_type === 'event_gold' ? '#D97706' : '#059669';
              return '<div style="display:flex;gap:10px;padding:6px 0;align-items:flex-start"><div style="width:10px;height:10px;border-radius:50%;background:' + c + ';flex-shrink:0;margin-top:5px"></div><div style="flex:1;font-size:12px;color:#C8D0E7;line-height:1.5">' + esc(ev.content) + '</div><div style="font-size:11px;color:#7B84A3;flex-shrink:0">' + fmtDate(ev.created_at) + '</div></div>';
            }).join('')
          : '<div style="font-size:12px;color:#7B84A3">No events yet.</div>');
    _adminOpenModalShell(html);
  });
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
          + '<div class="item-card-header" style="cursor:pointer" onclick="openAdminCreatorProfile(\'' + s.influencer_id + '\')">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<div class="item-avatar" style="background:rgba(217,119,6,.15);color:#D97706">' + initials + '</div>'
          + '<div><div style="font-size:14px;font-weight:700;color:#fff">' + esc(name) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">' + esc(p.location||'') + ' · Requested ' + fmtDate(s.requested_at) + '</div></div></div>'
          + '<div style="text-align:right"><div style="font-size:14px;font-weight:900;color:#D97706">₹' + (s.amount||1999) + '</div>'
          + '<span class="badge badge-gold" style="margin-top:4px">Pending</span></div></div>'
          + '<div class="item-actions">'
          + '<button class="btn-approve" onclick="event.stopPropagation();activateShield(\'' + s.id + '\',\'' + s.influencer_id + '\',this)">&#128737; Activate</button>'
          + '<button class="btn-reject"  onclick="event.stopPropagation();rejectShield(\''   + s.id + '\',\'' + s.influencer_id + '\',this)">&#10006; Reject</button>'
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
        var dealId  = deal.id || dis.deal_id;
        return '<div class="item-card" style="margin-bottom:12px">'
          + '<div class="item-card-header" style="cursor:pointer" onclick="openAdminDealDetail(\'' + dealId + '\')"><div>'
          + '<div style="font-size:14px;font-weight:700;color:#fff">' + esc(creator) + ' × ' + esc(brand) + '</div>'
          + '<div style="font-size:12px;color:#7B84A3">Raised by ' + esc(raiser) + ' · ' + fmtDate(dis.created_at) + '</div></div>'
          + '<span class="badge badge-accent">Open</span></div>'
          + '<div style="font-size:13px;color:#C8D0E7;line-height:1.6">' + esc(dis.reason) + '</div>'
          + '<div class="item-actions">'
          + '<button class="btn-approve" onclick="event.stopPropagation();resolveDispute(\'' + dis.id + '\',this)">&#10003; Resolve</button>'
          + '<button class="btn-reject"  onclick="event.stopPropagation();escalateDispute(\'' + dis.id + '\',this)">&#10006; Escalate</button>'
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
  loadAdminNotifications();
  var initial = (window.location.hash || '').replace('#','');
  if (!initial || ['overview','users','shield','disputes','deals'].indexOf(initial) === -1) initial = 'overview';
  aSwitchTab(initial);
  aSetMob(initial);
});
