# アドバリー 予約フォーム

エアコン・浴室・洗濯機・ハウスクリーニングの「料金見積もり → 予約」を1ページで完結させる自社用フォームです。
GitHub Pages で無料公開でき、予約内容は Google スプレッドシートに保存・メール通知されます。

```
index.html          … 予約ページ本体
assets/config.js    … 設定（送信先URL・LINEのURLなど）← ここだけ編集
assets/app.js       … 料金計算・入力チェック・送信
assets/style.css    … デザイン
gas/Code.gs         … 受付処理（Google Apps Script に貼る）
```

## 1. GitHub Pages で公開する

1. このフォルダの中身を GitHub リポジトリにアップロード（例：`adobarry-reservation`）
2. リポジトリの **Settings → Pages** を開く
3. Source を **Deploy from a branch**、Branch を `main` / `/(root)` にして保存
4. 数分後、`https://<ユーザー名>.github.io/adobarry-reservation/` で表示されます

## 2. 送信先（Googleスプレッドシート）を用意する

1. Google スプレッドシートを新規作成（名前例：アドバリー予約）
2. メニュー **拡張機能 → Apps Script** を開き、`gas/Code.gs` の中身を貼り付けて保存
3. `SHOP_EMAIL` を通知を受け取りたいアドレスに変更
4. 右上 **デプロイ → 新しいデプロイ** → 種類「ウェブアプリ」
   - 実行するユーザー：**自分**
   - アクセスできるユーザー：**全員**
5. 表示された「ウェブアプリのURL」をコピーし、`assets/config.js` の `ENDPOINT` に貼り付け

`ENDPOINT` が空のあいだは **テストモード**（画面上は完了になるが送信されない）です。

## 3. その他の設定（assets/config.js）

| 項目 | 内容 |
|---|---|
| `LINE_URL` | 完了画面の「LINEで写真を送る」ボタンのリンク先 |
| `MIN_DAYS_AHEAD` | 何日後から予約できるか（初期値 2日後） |
| `TIME_SLOTS` | 到着時間の選択肢 |

料金を変える場合は `index.html` の `data-price="7500"` と表示金額（`7,500円／台`）を両方書き換えてください。

## 4. 既存サイトからのリンク

見積もり内容を引き継いでリンクできます。

```
https://<ユーザー名>.github.io/adobarry-reservation/?normal=2&cleaning=1&set1=1
```

使えるキー：
- エアコン：`normal` `cleaning` `set1` `set2` `outdoor` `drain` `antimold` `cap`
- 浴室：`bath_kama` `bath_ura` `bath_room` `bath_fan_multi` `bath_fan`
- 洗濯機：`wash_tate` `wash_beat` `wash_drum`
- ハウス：`h_hood` `h_kitchen` `h_toilet` `h_sink` `h_window` `h_veranda` `h_entrance` `h_floor`
- 最初に開くタブ：`tab=aircon` / `bath` / `washer` / `house`（例：`?tab=bath&bath_kama=1`）
