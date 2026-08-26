-- ============================================================
-- 予約に電話番号・コースを追加し、お客様評価と紐付けられるようにする追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 予約の連絡先とコース内容
alter table reservations add column phone text;
alter table reservations add column course text;

-- お客様評価を予約と紐付ける。予約が消えても評価は残したいので set null。
-- 同じ予約から二重に評価を作らないよう unique を付ける。
alter table guest_satisfaction_records
  add column reservation_id integer references reservations(id) on delete set null;
create unique index guest_satisfaction_records_reservation_id_key
  on guest_satisfaction_records(reservation_id)
  where reservation_id is not null;
