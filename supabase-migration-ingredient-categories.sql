-- ============================================================
-- 原価の材料を「肉・野菜・海鮮・調味料・その他」で分けるための追加分
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- 何度実行しても壊れません。
-- ============================================================

-- meat / vegetable / seafood / seasoning / other。今ある材料は「その他」になる。
alter table ingredients add column if not exists category text not null default 'other';

-- 歩留まり(%)。1000g買って掃除後に使えるのが800gなら 80。
-- 単価は「使える量」で割るので、捨てる分の値段も材料費に乗る。今ある材料は100(全部使える)。
alter table ingredients add column if not exists yield_rate numeric not null default 100
  check (yield_rate > 0 and yield_rate <= 100);
