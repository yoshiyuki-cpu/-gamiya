---
name: gamiya-app
description: 焼肉がみやアプリ（このリポジトリ）の作り方の決まりごと。画面を足す、項目を増やす、不具合を直す、通知やAI機能を触る——このリポジトリで手を動かすときは最初に読むこと。営業日が朝5時で切り替わること、データ取得をhooks/に分けること、複数端末で同時に見るためのRealtime、予約表とシフトの数え方、globals.cssのクラスで作る見た目、Whisperの呼び方などを扱う。
---

# 焼肉がみやアプリの決まりごと

開店前のチェック表を中心に、店の1日を回すためのアプリ。使うのは**営業中のホール・厨房スタッフ**で、
片手・数秒しか触れない。10画面（チェック／お客様評価／予約表／シフト／勤怠／壁紙注文／AI相談／
日報／議事録／レシピ）が `app/_components/Nav.tsx` に並んでいる。

## 1. 営業日は朝5時で切り替わる

深夜2時の作業も「前日の営業日」に入る。**日付を自分で組み立てず、必ず既存の関数を使う。**

| 場所 | 関数 |
|---|---|
| 画面（ブラウザ） | `lib/checklist.ts` の `todayKey()` / `todayLabelText()` / `recentBusinessDayKeys()` |
| タイムスタンプ列で絞る | `businessDayRange(dateKey)`（5時〜翌5時の範囲） |
| サーバー（cron・API） | `lib/lineNotify.ts` の `jstBusinessDayKey()`（サーバーはUTCなので9時間ズレを吸収する） |

画面とサーバーで違う日付を出すと、「チェックしたのに通知が来る」といった一番わかりにくい不具合になる。

## 2. データの取り方は hooks/ に、計算は lib/ に

- `hooks/use*.ts`：Supabaseの読み書き・購読・状態。画面はここから受け取るだけ
- `lib/*.ts`：日付や金額や並びの計算、定数。画面にもサーバーにも使えるよう純粋な関数にする
- `app/*/page.tsx` と `app/*/_components/*.tsx`：見た目と操作だけ

新しい機能もこの3層に分ける。page.tsx に Supabase 呼び出しを直接書かない。

## 3. 複数の端末が同時に見ている前提

チェック表は厨房とホールが同時に開く。`useChecklist` は Supabase Realtime を購読して、
他の端末の変更をその場に反映している。同じ性質のデータ（注文・チェック）を足すときも同じにする。

```ts
supabase.channel(`daily-records-${dailyKey}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_records',
      filter: `record_date=eq.${dailyKey}` }, payload => { ... })
```

- 古いイベントは `updated_at` を比べて捨てる（順番が入れ替わって届くことがある）
- 数量の入力は 500ms のデバウンス後に保存（1文字ごとに書かない）
- 担当者名は端末の `localStorage`（`gamiya:current-staff`）に覚えさせる

## 4. 予約表とシフトの数え方

**予約（`lib/reservations.ts`）**
- 時間は「17:00から15分刻みで何コマ目か」の整数。`Date` を持ち回さない
- `CLOSE_HOUR = 26`（深夜2時）。表示も26時制のまま（`slotLabel`）
- 卓はテーブル T1〜T4、座敷 Z5〜Z8 の8卓。1組が複数卓を使うことがある（座敷をつなぐ）
- 既定は90分＝6コマ

**シフト（`lib/shifts.ts`）**
- 月を前半（1〜15日）・後半（16日〜末日）に割って組む
- 日付は `'YYYY-MM-DD'` の文字列。社員／アルバイト、ホール／キッチン／両方の区分がある
- 何も出していない日は「出られる」とみなす（休み希望だけを集める）

## 5. 見た目は globals.css のクラスで作る

**Tailwindのユーティリティを並べる作り方はしていない。** `app/globals.css`（1500行超）に
クラスを定義し、`className="rv-sheet"` のように使う。新しい画面もこの方式に合わせること。

- 色は変数で決まっている：`--bg`(炭の黒) `--ember`(炭火のオレンジ) `--gold` `--cream` `--muted`
- 幅は `.app` の `max-width: 480px`。下のナビの分だけ `body` に余白がある
- 見出しは明朝（Shippori Mincho）、本文は Noto Sans JP
- 焼肉屋の暗い店内で見るので、白い背景のカードを足さない

## 6. 通知・AI・環境変数

- **LINEは友だち全員へのbroadcast**。`lib/lineNotify.ts` の部品を使い、新しい通知は
  `KEEP_REMAINING` に優先度を足す。詳しくは共通スキル `line-notify`
- cron は `vercel.json` に登録して初めて動く。時刻はUTC（17:30 JST → `30 8 * * *`）
- 文章の生成・要約・音声注文の解釈は Anthropic（`@anthropic-ai/sdk`）
- **音声の文字起こしだけ OpenAI Whisper**。`openai` SDKは使わず `fetch` + `FormData` で
  REST を直接叩く（SDK経由だと接続エラーが多発した。`app/api/transcribe-meeting/route.ts` のコメント参照）
- 環境変数が無くてもモジュール評価で落ちないよう、`supabase` や Anthropic のキーは
  placeholder にフォールバックさせる（ビルドが丸ごと落ちるのを防ぐため）

## 7. DBと、使われない機能

- SQLは `supabase-migration-<機能名>.sql` を新規作成（共通スキル `supabase-migration` に従う）
- 使われなくなった機能は消してよい（仕込みタイマー・卓ごとの来客チェックは実際に削除した）。
  ただしテーブルを消すのはオーナーに確認してから

出す前に共通スキル `release-check` を必ず通すこと。
