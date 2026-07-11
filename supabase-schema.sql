-- ============================================================
-- 焼肉がみや 開店準備チェックシート — schema, grants, realtime, seed
-- Run this once in the Supabase SQL Editor for a fresh project.
-- ============================================================

-- 1. Tables --------------------------------------------------

create table categories (
  id text primary key,              -- 'prep' | 'clean' | 'setup' | 'other'
  badge text not null,
  name text not null,
  sub text not null,
  sort_order integer not null
);

create table items (
  id serial primary key,
  category_id text not null references categories(id) on delete cascade,
  text text not null,
  has_quantity boolean not null default false,
  sort_order double precision not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index items_category_id_idx on items(category_id);

create table daily_records (
  id serial primary key,
  item_id integer not null references items(id) on delete cascade,
  record_date date not null,
  checked boolean not null default false,
  quantity_value text,
  checked_time text,                -- 'HH:MM', matches currentTimeLabel() exactly
  staff_name text,
  timer_started_at timestamptz,     -- null when stopped
  timer_accumulated_ms bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (item_id, record_date)
);
create index daily_records_record_date_idx on daily_records(record_date);

create table staff_names (
  id serial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 2. updated_at auto-bump (server clock = authoritative ordering) ----

create or replace function bump_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_bump_updated_at
before update on items
for each row execute function bump_updated_at();

create trigger daily_records_bump_updated_at
before update on daily_records
for each row execute function bump_updated_at();

-- 3. Restore-defaults / seed function -------------------------

create or replace function restore_default_checklist() returns void as $$
begin
  delete from items;  -- cascades to daily_records for every date

  insert into items (category_id, text, has_quantity, sort_order) values
    ('prep', '牛タンのスライス・仕込み', true, 100),
    ('prep', 'タレ・薬味(ネギ塩・レモンダレ)の準備', true, 200),
    ('prep', 'サラダ・キムチ・ナムルの盛り込み', true, 300),
    ('prep', 'ライスの炊飯確認', true, 400),
    ('prep', 'スープ・ユッケジャンの仕込み', true, 500),

    ('clean', '冷蔵庫・冷凍庫の温度チェック', false, 100),
    ('clean', '炭の準備・着火', false, 200),
    ('clean', '換気扇・ダクトの確認', false, 300),
    ('clean', 'トイレ・洗面所の清掃', false, 400),
    ('clean', 'テーブル・椅子・床の清掃', false, 500),

    ('setup', 'おしぼりの準備', false, 100),
    ('setup', '卓上調味料(塩・タレ・コショウ)の補充', false, 200),
    ('setup', 'メニュー表・POPの確認', false, 300),
    ('setup', 'のれん・看板出し', false, 400),
    ('setup', 'BGM・照明・空調の確認', false, 500),

    ('other', 'レジの釣銭準備', false, 100),
    ('other', '本日の予約確認', false, 200),
    ('other', 'スタッフの役割分担確認', false, 300),
    ('other', '本日のおすすめ・品切れ情報の共有', false, 400);
end;
$$ language plpgsql;

-- 4. Seed the fixed categories (never re-created by the app) --

insert into categories (id, badge, name, sub, sort_order) values
  ('prep',  '仕', '仕込み',       '食材の下準備',       1),
  ('clean', '清', '設備・清掃',   '厨房・店内の点検',   2),
  ('setup', '卓', 'セッティング', '開店前の店内準備',   3),
  ('other', '他', 'レジ・その他', '運営まわりの確認',   4);

select restore_default_checklist();  -- seeds the default 19 items

-- 5. Grants (anon key needs open CRUD; RLS intentionally left disabled) --

grant select, insert, update, delete on categories, items, daily_records, staff_names to anon;
grant usage, select on all sequences in schema public to anon;

-- 6. Enable Realtime on the mutable tables ---------------------

alter publication supabase_realtime add table items, daily_records, staff_names;
-- categories is static after seed — intentionally NOT added, no UI ever mutates it.

-- DELETE events only include primary-key columns in `old` by default, but
-- the client needs `item_id` from deleted daily_records rows (and it's
-- harmless/cheap to have full old rows for items too) — so widen replica identity.
alter table items replica identity full;
alter table daily_records replica identity full;
