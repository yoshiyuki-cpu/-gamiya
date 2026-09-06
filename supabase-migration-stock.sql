-- ============================================================
-- 在庫と発注の追加分
--
-- 在庫の数は、開店前チェックの「数量入力」で毎日入れている数を
-- そのまま使う。新しい入力の場所は作らない(毎日必ず開く画面に乗せる)。
-- ここで足すのは「その品目を何個下回ったら、どこに何個発注するか」という
-- 決めごとと、発注した記録だけ。
--
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 発注先。メールは後で自動送信に使う。今は宛先入りの下書きを開くのに使う。
create table suppliers (
  id serial primary key,
  name text not null,
  email text,
  note text,                       -- 締め時間・電話番号・担当者など
  -- 使わなくなった発注先は消さずに隠す。過去の発注履歴が壊れないように。
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 品目ごとの発注の決めごと。開店前チェックの数量入力の項目に1つ付く。
create table stock_rules (
  id serial primary key,
  item_id integer not null unique references items(id) on delete cascade,
  supplier_id integer references suppliers(id) on delete set null,
  threshold integer not null default 0,          -- この数を下回ったら発注
  order_qty integer not null default 1,          -- 1回に発注する数
  unit text,                                     -- 個・袋・kg など
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 発注した記録。消さない。同じ品目を何日も続けて知らせないための判定にも使う。
create table stock_orders (
  id serial primary key,
  item_id integer not null references items(id) on delete cascade,
  supplier_id integer references suppliers(id) on delete set null,
  qty integer not null,
  unit text,
  staff_name text,
  note text,
  ordered_at timestamptz not null default now()
);
create index stock_orders_item_idx on stock_orders(item_id, ordered_at desc);

create trigger suppliers_bump_updated_at
before update on suppliers
for each row execute function bump_updated_at();
create trigger stock_rules_bump_updated_at
before update on stock_rules
for each row execute function bump_updated_at();

grant select, insert, update, delete on suppliers, stock_rules, stock_orders to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table stock_rules, stock_orders;
alter table stock_rules replica identity full;
alter table stock_orders replica identity full;
