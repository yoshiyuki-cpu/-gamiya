-- ============================================================
-- 予約表(17時〜26時・15分刻み・8席)の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 時間は「17:00から15分刻みで何コマ目か」という整数で持つ。
-- start_slot 0 = 17:00、1 = 17:15 … 35 = 25:45。
-- duration_slots 6 = 90分、8 = 120分。
create table reservations (
  id serial primary key,
  reserve_date date not null,
  seat text not null,                                   -- 'T1'〜'T4'(テーブル) / 'Z5'〜'Z8'(座敷)
  start_slot integer not null check (start_slot >= 0 and start_slot < 36),
  duration_slots integer not null default 6 check (duration_slots > 0),
  name text,
  party_size integer,
  note text,                                            -- 「肉ケーキを出す」「炙りレバー2人前取り置き」など
  is_walk_in boolean not null default false,            -- 当日の飛び込み来店
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_date_idx on reservations(reserve_date);
create index reservations_date_seat_idx on reservations(reserve_date, seat);

create trigger reservations_bump_updated_at
before update on reservations
for each row execute function bump_updated_at();

grant select, insert, update, delete on reservations to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table reservations;
alter table reservations replica identity full;
