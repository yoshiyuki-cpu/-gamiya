-- ============================================================
-- 来客チェックをテーブルごとに分けて、複数テーブルを同時進行できるようにする追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

create table guest_check_sessions (
  id serial primary key,
  table_number text not null,
  item_id integer not null references guest_check_items(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique (table_number, item_id)
);
create index guest_check_sessions_table_number_idx on guest_check_sessions(table_number);

grant select, insert, update, delete on guest_check_sessions to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table guest_check_sessions;
alter table guest_check_sessions replica identity full;
