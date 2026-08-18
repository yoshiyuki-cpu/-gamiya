-- ============================================================
-- X(旧Twitter)の投稿記録と、LINEリマインド用の追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 「その日に投稿した」ことだけを記録する。行がある = 投稿済み。
-- 取り消しは行の削除なので、未投稿の日は行が無い状態になる。
create table x_posts (
  id serial primary key,
  post_date date not null unique,
  posted_at timestamptz not null default now(),
  staff_name text,
  memo text,
  created_at timestamptz not null default now()
);
create index x_posts_post_date_idx on x_posts(post_date desc);

grant select, insert, update, delete on x_posts to anon;
grant usage, select on all sequences in schema public to anon;

alter publication supabase_realtime add table x_posts;
alter table x_posts replica identity full;
