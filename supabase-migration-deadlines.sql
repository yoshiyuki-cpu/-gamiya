-- ============================================================
-- 締め切り時間ごとにタスクをグループ表示できるようにする追加分
-- (例: 「16:00まで」「17:00オープンまで」「本日中」)
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

create table deadlines (
  id serial primary key,
  label text not null,
  sort_order double precision not null,
  created_at timestamptz not null default now()
);

insert into deadlines (label, sort_order) values
  ('16:00まで', 100),
  ('17:00オープンまで', 200),
  ('本日中', 300);

alter table items add column deadline_id integer references deadlines(id) on delete set null;

grant select, insert, update, delete on deadlines to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table deadlines;
alter table deadlines replica identity full;
