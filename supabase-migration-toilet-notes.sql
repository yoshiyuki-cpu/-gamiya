-- ============================================================
-- 「トイレ清掃」の11項目を、チェックの付かない手順メモに切り替える
--
-- 経緯: 掃除そのものは「設備・清掃」の「トイレ・洗面所の清掃」で
-- 30日中29日(97%)やられている。一方「トイレ清掃」の11項目は3日(10%)。
-- 同じ作業を2か所で記録させていたため、1タップで済むほうだけが押されていた。
-- 中身(ペーパー・石鹸・芳香剤・ゴミ箱・便座など)は新人が見て動ける手順なので、
-- 消さずに「読むだけの行」として画面に残す。
--
-- 実行すると
--   ・11項目はチェック欄も数量欄も出なくなる(押す対象から外れる)
--   ・「◯/◯ 完了」の分母から外れるので、実施率が実態に近づく
--   ・区分の見出しに「手順」と出る
--   ・11項目に残っていた過去のチェック記録(3日ぶん)は消える
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 手順メモの列がまだ無ければ足す(supabase-migration-checklist-notes.sql を
-- 実行済みなら何も起きない)。どちらの順で実行しても通るようにしている。
alter table items add column if not exists is_note boolean not null default false;

-- ① 何が変わるかを先に見る。ここで11行出ることを確かめてから②に進む。
select c.name as 区分, i.text as 項目, i.is_note as 現在の手順メモ
from items i
join categories c on c.id = i.category_id
where c.name = 'トイレ清掃'
order by i.sort_order;

-- ② 手順メモに切り替える。数量入力とは同時に持てないので外す。
update items
set is_note = true, has_quantity = false
where category_id in (select id from categories where name = 'トイレ清掃');

-- ③ 手順メモになった項目の過去のチェック記録は意味がなくなるので消す。
delete from daily_records
where item_id in (
  select i.id
  from items i
  join categories c on c.id = i.category_id
  where c.name = 'トイレ清掃'
);
