# Slackの予約チャンネル → 予約表

Slackの予約チャンネルに「9/5 19時 田中様 4名」と書くと、予約表に入って ✅ が付きます。
スレッドに「取消」と返すとキャンセルになります。

## 書き方

| 書く | 読み方 |
|---|---|
| `9/5 19時 田中様 4名` | 9月5日 19:00〜20:30 田中様 4名 |
| `明日 18時半 佐藤様 大人4 子供2 電話` | 明日 18:30 6名(うち子供2) 経路: 電話 |
| `10日 20:00 鈴木さん 6名 090-1234-5678 食べ放題コース` | 今月10日(過ぎていれば来月) 電話・コースも入る |
| （スレッドに）`取消` | その予約をキャンセルに |

- 日付と時刻は必須。名前・人数は無くても入る
- 「7時」は19時と読む。深夜は「25時」「1時」どちらでも
- 4名まではテーブル、5名以上は座敷、9名以上は座敷2つを自動で選ぶ。空きが無ければ卓なしで入るので予約表で選ぶ
- 決まった形で読めない文はAIが読む。それでも読めなければ「読み取れませんでした」と返す
- 予約表の備考に「Slackから: 元の文」が残る

## 初回の設定(社長がやること)

### 1. Supabase
`supabase-migration-slack-reservations.sql` を SQL Editor で実行する。

### 2. Slack アプリを作る
1. https://api.slack.com/apps → **Create New App** → **From scratch**
2. 名前 `がみや予約`、ワークスペースを選ぶ
3. 左メニュー **OAuth & Permissions** → *Bot Token Scopes* に次を追加
   - `channels:history`（公開チャンネルを読む）
   - `groups:history`（非公開チャンネルを読む。予約チャンネルが非公開なら）
   - `chat:write`（スレッドに返事する）
   - `reactions:write`（✅ を付ける）
4. 同じ画面の上 **Install to Workspace** → 許可 → 出てきた **Bot User OAuth Token**（`xoxb-` で始まる）を控える
5. 左メニュー **Basic Information** → *App Credentials* の **Signing Secret** を控える

### 3. Vercel に環境変数を入れる
Vercel → gamiya → Settings → Environment Variables（Production）

| 名前 | 値 |
|---|---|
| `SLACK_SIGNING_SECRET` | 2-5 の Signing Secret |
| `SLACK_BOT_TOKEN` | 2-4 の `xoxb-…` |
| `SLACK_RESERVATION_CHANNEL` | 予約チャンネルのID（`C` で始まる。チャンネル名をクリック → 一番下に出る）。複数ならカンマ区切り |

入れたら **Redeploy**（Deployments → 最新 → ⋯ → Redeploy）。

### 4. Slack に受け口を登録する（3の後で）
1. Slack アプリの左メニュー **Event Subscriptions** → Enable Events を ON
2. **Request URL** に `https://gamiya.vercel.app/api/slack/events` → 「Verified ✓」になるのを確認
3. 下の **Subscribe to bot events** に `message.channels`（非公開なら `message.groups` も）を追加 → **Save Changes**
4. 上に黄色い帯が出たら **reinstall your app** をクリック

### 5. チャンネルに Bot を入れる
予約チャンネルで `/invite @がみや予約`。

### 6. 試す
`明日 19時 テスト様 2名` と書いて ✅ と返事が付けば完成。スレッドに `取消` でキャンセルに。

## 動かないとき
- 何も返ってこない → Vercel の Logs で `/api/slack/events` を見る。`SLACK_SIGNING_SECRET が未設定` なら 3 をやり直す
- 「Request URL」が Verified にならない → 3 の環境変数を入れて Redeploy してから 4 をやる
- ✅ は付くのに予約表に無い → 予約表は「営業日」で日付を見る。深夜0〜5時の投稿は前日扱い
- Bot がチャンネルの投稿を読めない → 5 の招待を忘れている
