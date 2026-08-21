-- ============================================================
-- 仕込みタイマーと締め切り設定を削除した分の後片付け（任意）
--
-- アプリ側では既に使っていないため、実行しなくても動作に影響はありません。
-- データベースを整理したい場合だけ実行してください。
--
-- ※ 実行すると元に戻せません。ただしどちらも利用実績0件のため、
--    失われる記録はありません。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 仕込みタイマーが使っていた列
alter table daily_records drop column if exists timer_started_at;
alter table daily_records drop column if exists timer_accumulated_ms;

-- 締め切り設定
alter table items drop column if exists deadline_id;
drop table if exists deadlines;
