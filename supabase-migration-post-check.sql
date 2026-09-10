-- ============================================================
-- 「ポストの確認をしました」を押さないと出勤できない機能の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- true の人は、出勤の前に「ポストの確認をしました」を押さないと出勤できない。
-- どの人に付けるかは「勤怠」の「管理・書き出し」→スタッフの管理から直せる。
alter table staff_names add column if not exists checks_post boolean not null default false;

-- 最初は店長・赤木の2人に付けておく(既にこの名前で登録済みの場合のみ)。
-- 名前が違う・他にも足したい場合は、上のスタッフの管理から直してください。
update staff_names set checks_post = true where name in ('店長', '赤木');

-- 行が存在する = その営業日にポスト(郵便受け)を確認した、という意味。
-- 店長・赤木のどちらかが出勤のときに1回押せば、その日はもう出ない(共有の確認)。
create table if not exists post_checks (
  id serial primary key,
  check_date date not null unique,
  staff_name text,
  created_at timestamptz not null default now()
);
create index if not exists post_checks_check_date_idx on post_checks(check_date desc);

grant select, insert, delete on post_checks to anon;
grant usage, select on all sequences in schema public to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'post_checks'
  ) then
    alter publication supabase_realtime add table post_checks;
  end if;
end $$;
alter table post_checks replica identity full;
