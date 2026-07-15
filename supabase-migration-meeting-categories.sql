-- ============================================================
-- 議事録の種別（朝礼・会議・日報）とメモ欄の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

alter table meetings add column if not exists category text not null default 'mtg';
alter table meetings add column if not exists memo text;
