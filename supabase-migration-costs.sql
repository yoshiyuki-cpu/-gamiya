-- ============================================================
-- メニューごとの原価計算の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- 材料。「1000g を 3,800円で買う」のように、買う量と値段で持つ。
-- 単価(円/g)は画面で計算する。値段が変わったらここを直すだけで全メニューに効く。
create table if not exists ingredients (
  id serial primary key,
  name text not null,
  unit text not null default 'g',
  pack_qty numeric not null default 1 check (pack_qty > 0),
  pack_price numeric not null default 0 check (pack_price >= 0),
  note text,
  active boolean not null default true,      -- 使わなくなったら false(消さない)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- メニュー(商品)。売価と目標原価率。
create table if not exists menu_items (
  id serial primary key,
  name text not null,
  category text not null default 'meat',
  price numeric check (price is null or price >= 0),   -- 売価(税込・円)
  target_rate numeric check (target_rate is null or (target_rate > 0 and target_rate < 100)), -- 目標原価率(%)
  note text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1皿に使う材料と量。
create table if not exists menu_ingredients (
  id serial primary key,
  menu_item_id integer not null references menu_items(id) on delete cascade,
  ingredient_id integer not null references ingredients(id) on delete restrict,
  qty numeric not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_ingredients_menu_idx on menu_ingredients(menu_item_id);
create index if not exists menu_ingredients_ingredient_idx on menu_ingredients(ingredient_id);

drop trigger if exists ingredients_bump_updated_at on ingredients;
create trigger ingredients_bump_updated_at before update on ingredients for each row execute function bump_updated_at();
drop trigger if exists menu_items_bump_updated_at on menu_items;
create trigger menu_items_bump_updated_at before update on menu_items for each row execute function bump_updated_at();
drop trigger if exists menu_ingredients_bump_updated_at on menu_ingredients;
create trigger menu_ingredients_bump_updated_at before update on menu_ingredients for each row execute function bump_updated_at();

grant select, insert, update on ingredients to anon;
grant select, insert, update on menu_items to anon;
grant select, insert, update, delete on menu_ingredients to anon;   -- 材料の行だけは付け外しするので delete も
grant usage, select on all sequences in schema public to anon;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ingredients') then
    alter publication supabase_realtime add table ingredients;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menu_items') then
    alter publication supabase_realtime add table menu_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'menu_ingredients') then
    alter publication supabase_realtime add table menu_ingredients;
  end if;
end $$;
alter table ingredients replica identity full;
alter table menu_items replica identity full;
alter table menu_ingredients replica identity full;
