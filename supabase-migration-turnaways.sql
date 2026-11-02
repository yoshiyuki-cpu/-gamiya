-- ============================================================
-- 店長・赤木が退勤のときに「今日断った組数」を入れる機能の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- true の人は、退勤のときに「今日断った組数」を入れないと退勤できない。
-- どの人に付けるかは「勤怠」の「管理・書き出し」→スタッフの管理から直せる。
alter table staff_names add column if not exists logs_turnaways boolean not null default false;

-- 最初は店長・赤木の2人に付けておく(既にこの名前で登録済みの場合のみ)。
update staff_names set logs_turnaways = true where name in ('店長', '赤木');

-- 1営業日につき1行。店長と赤木がそれぞれ入れても二重に数えないよう、
-- あとから入れた人が同じ行を書き換える(合計ではなく、その日の最終の数)。
create table if not exists turnaway_counts (
  id serial primary key,
  count_date date not null unique,
  groups integer not null check (groups >= 0),
  staff_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists turnaway_counts_date_idx on turnaway_counts(count_date desc);

drop trigger if exists turnaway_counts_bump_updated_at on turnaway_counts;
create trigger turnaway_counts_bump_updated_at
before update on turnaway_counts
for each row execute function bump_updated_at();

grant select, insert, update on turnaway_counts to anon;
grant usage, select on all sequences in schema public to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'turnaway_counts'
  ) then
    alter publication supabase_realtime add table turnaway_counts;
  end if;
end $$;
alter table turnaway_counts replica identity full;
