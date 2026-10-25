-- ============================================================
-- 退勤のときに「ドリンクのおかわりを何杯とれたか」を残す機能の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- 1回の勤務(出勤〜退勤)につき1つ。null = 入力なし(この機能の前の記録など)。
-- 0杯のときは 0 を入れるので、「0杯だった」と「入れ忘れ」を区別できる。
alter table time_entries add column if not exists drink_refills integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_drink_refills_nonneg'
  ) then
    alter table time_entries
      add constraint time_entries_drink_refills_nonneg check (drink_refills is null or drink_refills >= 0);
  end if;
end $$;
