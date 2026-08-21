-- ============================================================
-- タイムカード(出勤・休憩・退勤の打刻)の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 1件 = 1回の勤務。work_date は営業日(朝5時区切り)なので、
-- 17:00〜翌1:00の勤務も1日分としてまとまる。
-- 昼と夜で2回入るような分割勤務にも対応できるよう、
-- 1人1日1件の制約はあえて付けていない。
create table time_entries (
  id serial primary key,
  staff_name text not null,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,          -- null = まだ勤務中
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_work_date_idx on time_entries(work_date desc);
create index time_entries_staff_idx on time_entries(staff_name);

-- 休憩。1回の勤務に何度でもぶら下がる。break_end が null = 休憩中。
create table time_breaks (
  id serial primary key,
  entry_id integer not null references time_entries(id) on delete cascade,
  break_start timestamptz not null,
  break_end timestamptz,
  created_at timestamptz not null default now()
);
create index time_breaks_entry_idx on time_breaks(entry_id);

create trigger time_entries_bump_updated_at
before update on time_entries
for each row execute function bump_updated_at();

grant select, insert, update, delete on time_entries, time_breaks to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table time_entries, time_breaks;
alter table time_entries replica identity full;
alter table time_breaks replica identity full;
