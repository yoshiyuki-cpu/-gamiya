-- ============================================================
-- レシピ帳機能の追加分 — 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 事前準備: Storage → New bucket で "recipe-photos" という名前の
-- Public バケットを先に作成してから、このSQLを実行してください。
--
-- (前回の実行でテーブル作成までは成功しているため、このファイルは
--  再実行しても安全なように IF NOT EXISTS 等で書き直してあります)
-- ============================================================

create table if not exists recipes (
  id serial primary key,
  category text not null,
  name text not null,
  prep_time text,
  ingredients text,
  steps text,
  notes text,
  photo_url text,
  sort_order double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_category_idx on recipes(category);

create or replace function bump_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recipes_bump_updated_at on recipes;
create trigger recipes_bump_updated_at
before update on recipes
for each row execute function bump_updated_at();

grant select, insert, update, delete on recipes to anon;
grant usage, select on sequence recipes_id_seq to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table recipes;
  end if;
end $$;
alter table recipes replica identity full;

drop policy if exists "recipe-photos insert" on storage.objects;
create policy "recipe-photos insert" on storage.objects for insert to anon with check (bucket_id = 'recipe-photos');
drop policy if exists "recipe-photos select" on storage.objects;
create policy "recipe-photos select" on storage.objects for select to anon using (bucket_id = 'recipe-photos');
drop policy if exists "recipe-photos delete" on storage.objects;
create policy "recipe-photos delete" on storage.objects for delete to anon using (bucket_id = 'recipe-photos');
