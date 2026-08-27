-- ============================================================
-- シフト管理(休み希望の収集・過不足の判定・シフトの確定)の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 既にある staff_names に区分を足す。
-- role: 'staff' 社員 / 'parttime' アルバイト
-- position: 'hall' ホール / 'kitchen' キッチン / 'both' 両方
alter table staff_names add column role text not null default 'parttime';
alter table staff_names add column position text not null default 'both';
alter table staff_names add column active boolean not null default true;

-- 曜日ごとの必要人数。weekday 0=日曜 … 6=土曜。
create table shift_requirements (
  weekday integer primary key check (weekday between 0 and 6),
  total_needed integer not null default 3,
  hall_needed integer not null default 2,
  kitchen_needed integer not null default 1,
  staff_needed integer not null default 1,
  updated_at timestamptz not null default now()
);

-- 曜日の初期値。金土は忙しいので多め。あとから画面で変えられる。
insert into shift_requirements (weekday, total_needed, hall_needed, kitchen_needed, staff_needed) values
  (0, 4, 2, 1, 1),  -- 日
  (1, 3, 2, 1, 1),  -- 月
  (2, 3, 2, 1, 1),  -- 火
  (3, 3, 2, 1, 1),  -- 水
  (4, 3, 2, 1, 1),  -- 木
  (5, 5, 3, 2, 1),  -- 金
  (6, 5, 3, 2, 1);  -- 土

-- 宴会が入った日など、その日だけ人数を変えたいとき用。
create table shift_requirement_overrides (
  work_date date primary key,
  total_needed integer not null,
  hall_needed integer not null,
  kitchen_needed integer not null,
  staff_needed integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 休み希望・出勤希望。
-- kind: 'off' 休みたい / 'want' できれば入りたい
-- 何も出していない日は「出られる」とみなす。全員が全日入力する運用は続かないため。
create table shift_requests (
  id serial primary key,
  staff_name text not null,
  work_date date not null,
  kind text not null check (kind in ('off', 'want')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_name, work_date)
);
create index shift_requests_date_idx on shift_requests(work_date);

-- 確定したシフト。
create table shift_assignments (
  id serial primary key,
  staff_name text not null,
  work_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_name, work_date)
);
create index shift_assignments_date_idx on shift_assignments(work_date);

-- 「この期間の希望はもう出し終えた」という記録。
-- 未提出の人にだけ声をかけるために要る。
create table shift_submissions (
  id serial primary key,
  staff_name text not null,
  period_key text not null,          -- '2026-09-first' / '2026-09-second'
  submitted_at timestamptz not null default now(),
  unique (staff_name, period_key)
);

-- 締め切りの設定。1行だけ持つ。
-- first_half_deadline_day: 前半(1〜15日)の希望を、前の月の何日まで
-- second_half_deadline_day: 後半(16〜末日)の希望を、同じ月の何日まで
create table shift_settings (
  id integer primary key default 1 check (id = 1),
  first_half_deadline_day integer not null default 20,
  second_half_deadline_day integer not null default 5,
  updated_at timestamptz not null default now()
);
insert into shift_settings (id) values (1);

create trigger shift_requirements_bump_updated_at
before update on shift_requirements
for each row execute function bump_updated_at();
create trigger shift_requirement_overrides_bump_updated_at
before update on shift_requirement_overrides
for each row execute function bump_updated_at();
create trigger shift_requests_bump_updated_at
before update on shift_requests
for each row execute function bump_updated_at();
create trigger shift_assignments_bump_updated_at
before update on shift_assignments
for each row execute function bump_updated_at();
create trigger shift_settings_bump_updated_at
before update on shift_settings
for each row execute function bump_updated_at();

grant select, insert, update, delete on
  shift_requirements, shift_requirement_overrides, shift_requests,
  shift_assignments, shift_submissions, shift_settings to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table shift_requests, shift_assignments, shift_submissions;
alter table shift_requests replica identity full;
alter table shift_assignments replica identity full;
alter table shift_submissions replica identity full;
