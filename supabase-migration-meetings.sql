-- ============================================================
-- 議事録機能の追加分 — 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
-- (supabase-schema.sql は新規プロジェクト用の全体スキーマなので
--  既存プロジェクトでは実行しないでください)
--
-- 事前準備: Storage → New bucket で "meeting-audio" という名前の
-- Public バケットを先に作成してから、このSQLを実行してください。
-- ============================================================

create table meetings (
  id serial primary key,
  meeting_date date not null,
  title text,
  audio_url text,
  transcript text,
  summary_overview text,
  summary_decisions text,
  summary_action_items text,
  status text not null default 'recorded',
  -- 'recorded' | 'transcribing' | 'transcribed' | 'summarizing' | 'done' | 'error'
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_date_idx on meetings(meeting_date desc);

create trigger meetings_bump_updated_at
before update on meetings
for each row execute function bump_updated_at();

grant select, insert, update, delete on meetings to anon;
grant usage, select on sequence meetings_id_seq to anon;

alter publication supabase_realtime add table meetings;
alter table meetings replica identity full;

create policy "meeting-audio insert" on storage.objects for insert to anon with check (bucket_id = 'meeting-audio');
create policy "meeting-audio select" on storage.objects for select to anon using (bucket_id = 'meeting-audio');
create policy "meeting-audio delete" on storage.objects for delete to anon using (bucket_id = 'meeting-audio');
