/**
 * アドバリー 予約受付（Google Apps Script）
 * 予約フォームの送信内容を Google スプレッドシートに保存し、
 * お店とお客様の両方にメールで通知します。
 *
 * 使い方は README.md の「2. 送信先（Googleスプレッドシート）を用意する」を参照。
 */

// ===== 設定 =====
const SHOP_EMAIL = "ここに通知先メールアドレス"; // 予約通知を受け取るアドレス（Apps Script に貼った後で書き換え）
const SHOP_NAME = "アドバリー";
const SEND_CUSTOMER_MAIL = true;             // お客様への自動返信メール

const COLUMNS = [
  ["id", "受付番号"], ["submittedAt", "受付日時"], ["name", "お名前"], ["zip", "郵便番号"],
  ["address", "住所"], ["tel", "電話番号"], ["email", "メール"],
  ["wish1", "第一希望"], ["wish2", "第二希望"], ["wish3", "第三希望"],
  ["units", "台数"], ["items", "内訳"], ["total", "概算合計(円)"],
  ["aircon", "エアコン情報"], ["parking", "駐車スペース"], ["payment", "支払方法"],
  ["visit", "利用"], ["pet", "ペット"], ["notes", "備考"]
];

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.company) return ok_(); // スパム（隠し項目に入力あり）は無視

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    sheet.appendRow(COLUMNS.map(([k]) => p[k] || ""));
  } finally {
    lock.releaseLock();
  }

  const body = COLUMNS.map(([k, label]) => `■${label}\n${p[k] || "-"}`).join("\n\n");

  MailApp.sendEmail({
    to: SHOP_EMAIL,
    replyTo: p.email || SHOP_EMAIL,
    subject: `【新規予約】${p.name || ""} 様（${p.units || "?"}台・${Number(p.total || 0).toLocaleString()}円）`,
    body: body
  });

  if (SEND_CUSTOMER_MAIL && p.email) {
    MailApp.sendEmail({
      to: p.email,
      replyTo: SHOP_EMAIL,
      name: SHOP_NAME,
      subject: `【${SHOP_NAME}】ご予約を受け付けました（受付番号 ${p.id}）`,
      body:
        `${p.name} 様\n\nこの度は${SHOP_NAME}にご予約いただき、ありがとうございます。\n` +
        `以下の内容で受け付けました。担当スタッフより日程確定のご連絡をいたします。\n\n` +
        `受付番号：${p.id}\n第一希望：${p.wish1}\n第二希望：${p.wish2}\n第三希望：${p.wish3}\n\n` +
        `【ご依頼内容】\n${p.items}\n概算合計：${Number(p.total || 0).toLocaleString()}円（税込）\n\n` +
        `※表示金額は概算です。最終的な料金は作業前にスタッフが確認のうえ確定します。\n` +
        `　追加費用が発生する場合は必ず事前にご説明いたします。\n\n` +
        `${SHOP_NAME}｜営業時間 8:00〜18:00\n`
    });
  }
  return ok_();
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("予約");
  if (!sheet) {
    sheet = ss.insertSheet("予約");
    sheet.appendRow(COLUMNS.map(([, label]) => label));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
