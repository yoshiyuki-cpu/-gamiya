-- ============================================================
-- 壁紙メニュー注文機能の追加分 — 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
-- (supabase-schema.sql は新規プロジェクト用の全体スキーマなので
--  既存プロジェクトでは実行しないでください)
-- ============================================================

create table wall_menu_items (
  id serial primary key,
  name text not null unique,
  sort_order double precision not null,
  created_at timestamptz not null default now()
);
create index wall_menu_items_sort_idx on wall_menu_items(sort_order);

create table wall_orders (
  id serial primary key,
  table_number text not null,
  item_name text not null,
  quantity integer not null default 1,
  staff_name text,
  created_at timestamptz not null default now()
);
create index wall_orders_created_at_idx on wall_orders(created_at);

grant select, insert, update, delete on wall_menu_items, wall_orders to anon;
grant usage, select on sequence wall_menu_items_id_seq, wall_orders_id_seq to anon;

alter publication supabase_realtime add table wall_menu_items, wall_orders;
alter table wall_menu_items replica identity full;
alter table wall_orders replica identity full;
