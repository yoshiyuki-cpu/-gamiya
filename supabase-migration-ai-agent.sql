-- ============================================================
-- AIエージェント機能（音声注文入力・AIアシスタント・日報）の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
-- ============================================================

-- 対応済みの壁紙メニュー注文も日報の集計に使えるよう、削除ではなく
-- completed_at を立てて「対応中」から外す方式に変更する。
alter table wall_orders add column completed_at timestamptz;

create table daily_reports (
  id serial primary key,
  report_date date not null unique,
  summary text not null,
  stats jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on daily_reports to anon;
grant usage, select on sequence daily_reports_id_seq to anon;

alter publication supabase_realtime add table daily_reports;
alter table daily_reports replica identity full;
