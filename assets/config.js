// ===== 設定ファイル：ここだけ書き換えれば動きます =====
window.ADOBARRY_CONFIG = {
  // Google Apps Script（gas/Code.gs）を「ウェブアプリ」として公開したURLを貼り付けてください。
  // 空のままだと送信はテストモード（実際には送られません）になります。
  ENDPOINT: "https://script.google.com/macros/s/AKfycbyFqIARIvQHy1d6SlHr-whyYykNJM12X9qkPU1aP_h34sEf6LsX5Riz9__A2l7-8XfbqA/exec",

  // 予約完了画面に出す LINE 公式アカウントのURL（例: https://lin.ee/xxxxxxx）
  LINE_URL: "",

  // 予約可能な最短日（今日から何日後か）
  MIN_DAYS_AHEAD: 2,

  // 到着時間の選択肢
  TIME_SLOTS: ["8〜9時", "12〜14時", "15〜18時"],

  // 1種類あたりの最大台数
  MAX_QTY: 10
};
