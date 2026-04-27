-- ═══════════════════════════════════════════════════════════
--  ZEKE — SUPABASE SCHEMA
--  Run this entire file in the Supabase SQL Editor
--  Dashboard → SQL Editor → New Query → Paste → Run
-- ═══════════════════════════════════════════════════════════


-- ── 1. PROFILES ────────────────────────────────────────────
-- Extends Supabase auth.users. One row per user.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('influencer','brand','admin')),
  display_name  text not null,
  location      text,
  created_at    timestamptz default now()
);

-- ── 2. INFLUENCER PROFILES ─────────────────────────────────
create table if not exists public.influencer_profiles (
  id              uuid primary key references public.profiles(id) on delete cascade,
  handle          text,                        -- e.g. aligerouszz (no @)
  niche           text,
  is_adult        boolean default true,
  ig_followers    int    not null default 0,      -- mandatory
  yt_followers    int,
  x_followers     int,
  yt_handle       text,
  x_handle        text,
  yt_enabled      boolean default false,
  x_enabled       boolean default false,
  rating          numeric(2,1) default 0,
  shield_active   boolean default false,
  shield_expires  date,
  verified        boolean default false,
  updated_at      timestamptz default now()
);

-- ── 3. BRAND PROFILES ──────────────────────────────────────
create table if not exists public.brand_profiles (
  id           uuid primary key references public.profiles(id) on delete cascade,
  brand_type   text check (brand_type in ('business','ngo','agency')),
  updated_at   timestamptz default now()
);

-- ── 4. GUARDIAN INFO (for under-18 creators) ───────────────
create table if not exists public.guardians (
  id               uuid primary key default gen_random_uuid(),
  influencer_id    uuid references public.influencer_profiles(id) on delete cascade,
  guardian_name    text not null,
  guardian_email   text not null,
  relation         text not null,
  created_at       timestamptz default now()
);

-- ── 5. CAMPAIGNS ───────────────────────────────────────────
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid references public.profiles(id) on delete cascade,
  title       text not null,
  niche       text,
  budget      numeric(12,2),
  currency    text default 'INR',
  deadline    date,
  description text,
  status      text default 'active' check (status in ('active','paused','closed')),
  created_at  timestamptz default now()
);

-- ── 6. DEALS ───────────────────────────────────────────────
create table if not exists public.deals (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid references public.campaigns(id),
  brand_id        uuid references public.profiles(id),
  influencer_id   uuid references public.profiles(id),
  title           text not null,
  platform        text,                        -- e.g. Instagram Reel
  amount          numeric(12,2),
  currency        text default 'INR',
  deliverables    text,
  usage_rights    text,
  exclusivity     boolean default false,
  payment_terms   text,
  deadline        date,
  status          text default 'negotiating'
                  check (status in (
                    'negotiating','agreement_sent','active',
                    'submitted','approved','link_submitted',
                    'payment_sent','completed','cancelled','disputed'
                  )),
  cancel_requested_by  uuid,
  cancel_reason        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 7. DEAL MESSAGES (chat) ────────────────────────────────
create table if not exists public.deal_messages (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references public.deals(id) on delete cascade,
  sender_id   uuid references public.profiles(id),
  msg_type    text default 'text'
              check (msg_type in ('text','offer','event','event_gold')),
  content     text not null,
  created_at  timestamptz default now()
);

-- ── 8. SUBMISSIONS ─────────────────────────────────────────
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid references public.deals(id) on delete cascade,
  round         int default 1,
  file_url      text,
  file_name     text,
  file_size_mb  numeric(6,1),
  status        text default 'pending'
                check (status in ('pending','approved','rejected')),
  review_note   text,
  submitted_at  timestamptz default now(),
  reviewed_at   timestamptz
);

-- ── 9. FINAL LINKS ─────────────────────────────────────────
create table if not exists public.final_links (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid references public.deals(id) on delete cascade,
  url          text not null,
  submitted_at timestamptz default now()
);

-- ── 10. PAYMENT RECORDS ────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references public.deals(id) on delete cascade,
  amount          numeric(12,2),
  currency        text default 'INR',
  proof_url       text,
  sent_by         uuid references public.profiles(id),
  confirmed_by    uuid references public.profiles(id),
  status          text default 'pending'
                  check (status in ('pending','confirmed')),
  sent_at         timestamptz,
  confirmed_at    timestamptz
);

-- ── 11. AGREEMENTS ─────────────────────────────────────────
create table if not exists public.agreements (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid references public.deals(id) on delete cascade,
  pdf_url        text,
  generated_at   timestamptz default now(),
  signed_brand   boolean default false,
  signed_creator boolean default false
);

-- ── 12. DISPUTES ───────────────────────────────────────────
create table if not exists public.disputes (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid references public.deals(id),
  raised_by      uuid references public.profiles(id),
  reason         text not null,
  status         text default 'open'
                 check (status in ('open','resolved','escalated')),
  resolution     text,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);

-- ── 13. NOTIFICATIONS ──────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  type        text,                            -- e.g. 'deal','payment','system'
  read        boolean default false,
  created_at  timestamptz default now()
);


-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════

alter table public.profiles           enable row level security;
alter table public.influencer_profiles enable row level security;
alter table public.brand_profiles      enable row level security;
alter table public.guardians           enable row level security;
alter table public.campaigns           enable row level security;
alter table public.deals               enable row level security;
alter table public.deal_messages       enable row level security;
alter table public.submissions         enable row level security;
alter table public.final_links         enable row level security;
alter table public.payments            enable row level security;
alter table public.agreements          enable row level security;
alter table public.disputes            enable row level security;
alter table public.notifications       enable row level security;


-- PROFILES — own row only
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles_admin_read" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- INFLUENCER PROFILES — own + brands can read
create policy "inf_own" on public.influencer_profiles
  for all using (auth.uid() = id);

create policy "inf_brand_read" on public.influencer_profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('brand','admin'))
  );

-- BRAND PROFILES — own + influencers can read
create policy "brand_own" on public.brand_profiles
  for all using (auth.uid() = id);

create policy "brand_inf_read" on public.brand_profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('influencer','admin'))
  );

-- GUARDIANS — influencer owns their row
create policy "guardian_own" on public.guardians
  for all using (
    influencer_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- CAMPAIGNS — brand owns; influencers/admin can read
create policy "campaign_brand_own" on public.campaigns
  for all using (brand_id = auth.uid());

create policy "campaign_read" on public.campaigns
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('influencer','admin'))
  );

-- DEALS — both parties + admin
create policy "deal_parties" on public.deals
  for all using (
    brand_id = auth.uid() or influencer_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- DEAL MESSAGES — both parties + admin
create policy "msg_parties" on public.deal_messages
  for all using (
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- SUBMISSIONS — both parties + admin
create policy "sub_parties" on public.submissions
  for all using (
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- FINAL LINKS — both parties
create policy "link_parties" on public.final_links
  for all using (
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- PAYMENTS — both parties
create policy "pay_parties" on public.payments
  for all using (
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- AGREEMENTS — both parties
create policy "agree_parties" on public.agreements
  for all using (
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- DISPUTES — both parties + admin
create policy "dispute_parties" on public.disputes
  for all using (
    raised_by = auth.uid() or
    exists (
      select 1 from public.deals
      where id = deal_id and (brand_id = auth.uid() or influencer_id = auth.uid())
    ) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- NOTIFICATIONS — own only
create policy "notif_own" on public.notifications
  for all using (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════
--  REALTIME (enable for live chat + notifications)
-- ═══════════════════════════════════════════════════════════
-- Dashboard → Database → Replication → enable for:
--   deal_messages, notifications, deals

-- ═══════════════════════════════════════════════════════════
--  STORAGE BUCKETS (create in Dashboard → Storage)
-- ═══════════════════════════════════════════════════════════
-- Bucket: "submissions"   → private, max 200MB
-- Bucket: "payment-proof" → private, max 20MB
-- Bucket: "agreements"    → private, max 10MB
-- Bucket: "avatars"       → public,  max 5MB
