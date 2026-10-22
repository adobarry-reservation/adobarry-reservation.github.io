/**
 * アドバリー 予約受付（Google Apps Script）
 * 予約フォームの送信内容を Google スプレッドシート「予約」シートに保存し、
 * お店とお客様の両方にメールで通知します。
 *
 * 使い方は README.md の「2. 送信先（Googleスプレッドシート）を用意する」を参照。
 */

// ===== 設定 =====
const SHOP_EMAIL = "ここに通知先メールアドレス"; // 予約通知を受け取るアドレス（Apps Script に貼った後で書き換え）
const SHOP_NAME = "アドバリー";
const SEND_CUSTOMER_MAIL = true;   // お客様への自動返信メール
const SHEET_NAME = "予約";
const REFERRAL_RATE = 0.2;         // 紹介料の割合（20%）

// ===== 列の並び（左から順に） =====
// 空欄で保存する列（支払い状況・作業確定日・PayPal・メモなど）はスタッフが手入力する欄です。
const HEADERS = [
  "受付番号", "受付日時", "お名前", "電話", "メール", "エリア", "郵便番号", "住所",
  "通常台数", "お掃除機能付き台数", "3点セット", "合計(税込)", "通常価格合計",
  "第1希望日", "第2希望日", "時間帯", "支払方法", "備考",
  "紹介コード", "紹介料(20%)", "支払い状況", "作業確定日", "PayPal請求書ID", "PayPal状態", "メモ",
  "3点セット台数", "防カビコート台数", "室外機台数", "ドレン台数",
  "住居タイプ", "住居タイプ根拠", "重複チェック", "同期状況（スケジュール表）", "紹介の判定", "紹介料お知らせ日", "紹介料締め日",
  // ↓ 予約フォームのメニューに合わせて追加した列
  "2点セット台数", "防虫キャップ台数",
  "風呂釜洗浄", "浴槽裏洗浄", "浴室クリーニング", "浴室多機能換気扇", "浴室換気扇",
  "縦型洗濯機", "ビートウォッシュ", "ドラム式洗濯機",
  "レンジフード", "キッチン", "トイレ", "洗面台", "床（見積もり希望）",
  "第3希望日", "メニュー", "内訳", "エアコン情報", "駐車スペース", "当店のご利用", "ペット"
];

// スタッフが手入力する列（黄色）
const MANUAL_COLUMNS = ["支払い状況", "作業確定日", "PayPal請求書ID", "PayPal状態", "メモ", "同期状況（スケジュール表）", "紹介料お知らせ日", "紹介料締め日"];

// フォームの項目名 → 列名（数量の列）
const QTY_COLUMNS = {
  normal: "通常台数", cleaning: "お掃除機能付き台数",
  set2: "3点セット台数", antimold: "防カビコート台数", outdoor: "室外機台数", drain: "ドレン台数",
  set1: "2点セット台数", cap: "防虫キャップ台数",
  bath_kama: "風呂釜洗浄", bath_ura: "浴槽裏洗浄", bath_room: "浴室クリーニング",
  bath_fan_multi: "浴室多機能換気扇", bath_fan: "浴室換気扇",
  wash_tate: "縦型洗濯機", wash_beat: "ビートウォッシュ", wash_drum: "ドラム式洗濯機",
  h_hood: "レンジフード", h_kitchen: "キッチン", h_toilet: "トイレ", h_sink: "洗面台", h_floor: "床（見積もり希望）"
};

// 既存の「予約」シートに足りない列を追加する（データはそのまま残る）
function addMissingColumns() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return;
  HEADERS.forEach((h, i) => {
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (current[i] === h) return;
    if (current.indexOf(h) === -1) {
      sheet.insertColumnBefore(i + 1);
      sheet.getRange(1, i + 1).setValue(h).setFontWeight("bold")
        .setBackground(MANUAL_COLUMNS.includes(h) ? "#fff4d6" : "#eaf6ec");
    }
  });
}

// 最初に一度だけ実行：シートの見出しを作り、権限を許可する
function setup() {
  getSheet_();
  MailApp.getRemainingDailyQuota();
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.company) return ok_(); // スパム（隠し項目に入力あり）は無視

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    sheet.appendRow(buildRow_(p, sheet));
  } finally {
    lock.releaseLock();
  }

  const totalText = Number(p.total || 0).toLocaleString() + "円" + (p.totalNote ? "〜" : "");
  const body =
    `受付番号：${p.id}\n受付日時：${p.submittedAt}\n\n` +
    `■お名前\n${p.name}\n\n■電話\n${p.tel}\n\n■メール\n${p.email}\n\n■住所\n〒${p.zip} ${p.address}\n\n` +
    `■ご希望日時\n第1希望：${p.wish1}\n第2希望：${p.wish2}\n第3希望：${p.wish3}\n\n` +
    `■内訳\n${p.items}\n合計（税込・概算）：${totalText}\n\n` +
    `■エアコン情報\n${p.aircon || "-"}\n\n■お住まいのタイプ\n${p.housing || "-"}\n\n■駐車スペース\n${p.parking || "-"}\n\n` +
    `■支払方法\n${p.payment || "-"}\n\n■当店のご利用\n${p.visit || "-"}\n\n■ペット\n${p.pet || "-"}\n\n` +
    `■紹介コード\n${p.referral || "-"}\n\n■備考\n${p.notes || "-"}\n`;

  MailApp.sendEmail({
    to: SHOP_EMAIL,
    replyTo: p.email || SHOP_EMAIL,
    subject: `【新規予約】${p.name || ""} 様（${p.categories || ""}・${totalText}）`,
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
        `受付番号：${p.id}\n第1希望：${p.wish1}\n第2希望：${p.wish2}\n第3希望：${p.wish3}\n\n` +
        `【ご依頼内容】\n${p.items}\n概算合計：${totalText}（税込）\n\n` +
        `※表示金額は概算です。最終的な料金は作業前にスタッフが確認のうえ確定します。\n` +
        `　追加費用が発生する場合は必ず事前にご説明いたします。\n\n` +
        `${SHOP_NAME}｜営業時間 8:00〜18:00\n`
    });
  }
  return ok_();
}

function buildRow_(p, sheet) {
  const v = {};
  const num = (k) => Number(p["q_" + k] || 0);
  const total = Number(p.total || 0);
  const referral = String(p.referral || "").trim();
  const housing = guessHousing_(p.address || "");

  v["受付番号"] = p.id;
  v["受付日時"] = p.submittedAt;
  v["お名前"] = p.name;
  v["電話"] = text_(p.tel);
  v["メール"] = p.email;
  v["エリア"] = prefecture_(p.address || "");
  v["郵便番号"] = text_(p.zip);
  v["住所"] = p.address;
  v["3点セット"] = num("set2") > 0 ? "あり" : "なし";
  v["合計(税込)"] = total;
  v["通常価格合計"] = Number(p.regularTotal || total); // 割引前の金額
  v["第1希望日"] = p.date1;
  v["第2希望日"] = p.date2;
  v["第3希望日"] = p.date3;
  v["時間帯"] = [p.time1, p.time2, p.time3].map((t, i) => `第${i + 1}:${t || "-"}`).join(" / ");
  v["支払方法"] = p.payment;
  v["備考"] = p.notes;
  v["紹介コード"] = text_(referral);
  v["紹介料(20%)"] = referral ? Math.round(total * REFERRAL_RATE) : "";
  v["紹介の判定"] = referral ? "紹介あり（要確認）" : "紹介なし";
  // お客様が選んだ住居タイプを優先し、住所からの推定と食い違う場合は根拠欄に残す
  const chosen = String(p.housing || "").trim();
  if (chosen) {
    v["住居タイプ"] = chosen;
    const mismatch = (chosen === "戸建て" && housing.type === "集合住宅") ||
                     (chosen === "マンション・アパート" && housing.type !== "集合住宅");
    v["住居タイプ根拠"] = "お客様の選択" + (mismatch ? `（住所からの推定：${housing.type}／${housing.reason}）` : "");
  } else {
    v["住居タイプ"] = housing.type;
    v["住居タイプ根拠"] = housing.reason;
  }
  v["重複チェック"] = duplicate_(sheet, p.tel);
  Object.keys(QTY_COLUMNS).forEach((k) => { v[QTY_COLUMNS[k]] = num(k) || ""; });
  v["メニュー"] = p.categories;
  v["内訳"] = p.items;
  v["エアコン情報"] = p.aircon;
  v["駐車スペース"] = p.parking;
  v["当店のご利用"] = p.visit;
  v["ペット"] = p.pet;

  return HEADERS.map((h) => (v[h] === undefined || v[h] === null ? "" : v[h]));
}

// 先頭の0が消えないよう文字列として保存
function text_(s) {
  return s ? "'" + s : "";
}

function prefecture_(addr) {
  const m = String(addr).match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)/);
  return m ? m[1] : "";
}

// 住所から住居タイプを推定（スタッフが確認して直してください）
function guessHousing_(addr) {
  const a = String(addr);
  const words = ["マンション", "アパート", "ハイツ", "コーポ", "レジデンス", "メゾン", "パレス", "ハイム", "荘", "号室", "棟", "階"];
  const hit = words.find((w) => a.includes(w));
  if (hit) return { type: "集合住宅", reason: `住所に「${hit}」を含む` };
  if (/\d+\s*[-‐－−]\s*\d+\s*[-‐－−]\s*\d+\s*\S*[^\d\s-‐－−]\S*\s*\d{3,4}\s*$/.test(a)) {
    return { type: "集合住宅", reason: "番地の後に建物名・部屋番号らしき記載あり" };
  }
  return { type: "戸建て（推定）", reason: "建物名・部屋番号の記載なし" };
}

// 同じ電話番号の過去の予約があれば知らせる
function duplicate_(sheet, tel) {
  const digits = String(tel || "").replace(/\D/g, "");
  if (!digits || sheet.getLastRow() < 2) return "";
  const telCol = HEADERS.indexOf("電話") + 1;
  const idCol = HEADERS.indexOf("受付番号") + 1;
  const n = sheet.getLastRow() - 1;
  const tels = sheet.getRange(2, telCol, n, 1).getValues();
  const ids = sheet.getRange(2, idCol, n, 1).getValues();
  const hits = [];
  tels.forEach((r, i) => { if (String(r[0]).replace(/\D/g, "") === digits) hits.push(ids[i][0]); });
  return hits.length ? `重複あり（${hits.slice(-3).join("、")}）` : "";
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (current.join("|") !== HEADERS.join("|")) addMissingColumns();
    const after = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (after.slice(0, HEADERS.length).join("|") !== HEADERS.join("|")) {
      // 列を足しても合わない古い形式のシートは残して名前を変える
      sheet.setName(SHEET_NAME + "_旧_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmm"));
      sheet = null;
    }
  }
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME, 0);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight("bold").setBackground("#eaf6ec");
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3);
    // スタッフ手入力欄は色分け
    MANUAL_COLUMNS.forEach((h) => sheet.getRange(1, HEADERS.indexOf(h) + 1).setBackground("#fff4d6"));
    sheet.getRange(2, HEADERS.indexOf("支払い状況") + 1, 999, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(["未払い", "支払い済み", "キャンセル"], true).build());
  }
  return sheet;
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
