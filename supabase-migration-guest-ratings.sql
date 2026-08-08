-- ============================================================
-- お客様評価を組(予約名・予約時間)単位の台帳にする追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 組の情報(予約名・予約時間・卓番号)を追加。過去の記録は null のまま残る
alter table guest_satisfaction_records add column table_number text;
alter table guest_satisfaction_records add column reservation_name text;
alter table guest_satisfaction_records add column reservation_time text;

-- 「登録だけして評価は帰り際につける」を可能にするため、rank を未評価(null)許可に
alter table guest_satisfaction_records alter column rank drop not null;

-- 複数端末での同時編集に備えて updated_at とリアルタイム配信を追加
alter table guest_satisfaction_records add column updated_at timestamptz not null default now();

create trigger guest_satisfaction_records_bump_updated_at
before update on guest_satisfaction_records
for each row execute function bump_updated_at();

alter publication supabase_realtime add table guest_satisfaction_records;
alter table guest_satisfaction_records replica identity full;
