-- ============================================================
-- 予約表を「当日回せる予約台帳」にするための追加分
--   ・1組が複数の卓を使えるようにする（座敷を繋ぐ大人数）
--   ・来店状態（未来店 / 来店中 / 退店 / キャンセル / 無断キャンセル）
--   ・予約経路（電話・Google・食べログ・Instagram など）
--   ・子供の人数
--
-- 既に構築済みのSupabaseプロジェクトに対して
-- SQL Editorでこのファイルの内容だけを実行してください。
--
-- 実行前に、画面上部のプロジェクト名が「gamiya」になっていることを
-- 必ず確認してください（他のプロジェクトと間違えやすいため）。
-- ============================================================

-- 1組が複数の卓を使えるようにする。
-- これまでの seat（1卓だけ）は seats に移して使わなくなる。
alter table reservations add column seats text[] not null default '{}';
update reservations set seats = array[seat] where seat is not null and seats = '{}';
alter table reservations drop column seat;

-- 来店の状態。予約表が当日役に立つかどうかは、ここが分かれ目。
-- キャンセルは行を消さずに状態で残す。消してしまうと
-- キャンセル率も無断キャンセル率も後から数えられなくなるため。
alter table reservations add column status text not null default 'booked'
  check (status in ('booked', 'seated', 'done', 'cancelled', 'noshow'));
alter table reservations add column seated_at timestamptz;   -- 着席した時刻
alter table reservations add column left_at timestamptz;     -- 退店した時刻

-- どこから入った予約か。広報や広告が組数になっているかを数えるため。
alter table reservations add column source text;

-- 人数のうち子供が何人か。席の作りも皿もオーダーも変わるため分けて持つ。
-- party_size は合計人数のまま（意味を変えない）。
alter table reservations add column child_size integer;

create index reservations_status_idx on reservations(reserve_date, status);
