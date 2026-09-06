-- ============================================================
-- 「良かった事・悪かった事」(スタッフのふりかえり)の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- 1行 = スタッフが書いた「良かった事」または「悪かった事」1つ。
-- 悪かった事は「直した」印(resolved_at)を付けられる。
-- 消すのではなく hidden で隠す(記録は消さない)。
create table if not exists reflections (
  id serial primary key,
  note_date date not null,                 -- 営業日(朝5時区切り)
  kind text not null check (kind in ('good', 'bad')),
  body text not null,
  staff_name text,
  resolved_at timestamptz,                 -- 悪かった事を直した日時
  resolved_by text,                        -- 直した人
  resolve_note text,                       -- どう直したか
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reflections_note_date_idx on reflections(note_date desc);

drop trigger if exists reflections_bump_updated_at on reflections;
create trigger reflections_bump_updated_at
before update on reflections
for each row execute function bump_updated_at();

-- delete は付けない。隠すだけにする。
grant select, insert, update on reflections to anon;
grant usage, select on all sequences in schema public to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'reflections'
  ) then
    alter publication supabase_realtime add table reflections;
  end if;
end $$;
alter table reflections replica identity full;
