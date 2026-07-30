-- ============================================================
-- 来客チェック(項目の並べ替えを全端末共通に)と満足度履歴の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

create table guest_check_items (
  id serial primary key,
  text text not null,
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger guest_check_items_bump_updated_at
before update on guest_check_items
for each row execute function bump_updated_at();

insert into guest_check_items (text, sort_order) values
  ('テーブル・椅子の清掃確認(汚れ・油べたつきなし)', 100),
  ('調味料(塩・タレ・レモン塩)の補充・清潔確認', 200),
  ('おしぼりの用意', 300),
  ('人数分のお皿の準備・清潔確認', 400),
  ('人数分のお箸の準備・清潔確認', 500),
  ('トングの清潔確認', 600),
  ('ハサミの清潔確認', 700),
  ('灰皿が2個ある(清潔確認)', 800),
  ('網・コンロの状態確認(交換・着火確認)', 900),
  ('ロースターの受け皿に水を入れたか', 1000),
  ('メニュー表・タブレットの動作確認', 1100),
  ('子ども椅子・座布団の要否確認', 1200),
  ('ご挨拶', 1300),
  ('来客動機を伺ったか', 1400),
  ('新メニューの説明', 1500),
  ('お通し(タンシチュー)を人数分提供', 1600),
  ('ファーストオーダー(5分以内)', 1700),
  ('バッシング(5分に1回)', 1800);

create table guest_satisfaction_records (
  id serial primary key,
  rank text not null check (rank in ('S','A','B','C','D','E')),
  visit_reason text,
  impression text,
  created_at timestamptz not null default now()
);
create index guest_satisfaction_records_created_at_idx on guest_satisfaction_records(created_at desc);

grant select, insert, update, delete on guest_check_items, guest_satisfaction_records to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table guest_check_items;
alter table guest_check_items replica identity full;
