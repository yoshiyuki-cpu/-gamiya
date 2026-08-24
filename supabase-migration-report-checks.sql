-- ============================================================
-- 前日分の報告業務チェック(と15時のLINEリマインド)の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 行が存在する = その営業日の朝に「前日分の報告業務」を済ませた、という意味。
-- 未対応の日は行が無いので、リマインドを送るかどうかの判定に使える。
create table report_checks (
  id serial primary key,
  check_date date not null unique,
  staff_name text,
  -- 社長への報告。内容がある場合だけ本文が入り、「特になし」なら null。
  president_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_checks_check_date_idx on report_checks(check_date desc);

create trigger report_checks_bump_updated_at
before update on report_checks
for each row execute function bump_updated_at();

grant select, insert, update, delete on report_checks to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table report_checks;
alter table report_checks replica identity full;
