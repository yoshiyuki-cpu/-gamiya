-- ============================================================
-- Slackの投稿から予約を入れるための追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- どのSlack投稿から入れた予約かを覚えておく。
-- スレッドに「取消」と返されたときに、この予約を探すのに使う。
-- 同じ投稿を二度入れない判定にも使う。
alter table reservations add column if not exists slack_channel text;
alter table reservations add column if not exists slack_ts text;
create index if not exists reservations_slack_ts_idx on reservations(slack_ts);
