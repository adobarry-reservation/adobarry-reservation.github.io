(function () {
  "use strict";
  var C = window.ADOBARRY_CONFIG || {};
  var form = document.getElementById("reserveForm");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var yen = function (n) { return n.toLocaleString("ja-JP") + "円"; };

  // ---------- 台数セレクトを生成 ----------
  $$("select.qty").forEach(function (sel) {
    for (var i = 0; i <= (C.MAX_QTY || 10); i++) {
      var o = document.createElement("option");
      o.value = i; o.textContent = i === 0 ? "なし" : i + "台";
      sel.appendChild(o);
    }
  });

  // ---------- 時間帯セレクト ----------
  $$('select[name^="time"]').forEach(function (sel) {
    sel.innerHTML = '<option value="">到着時間を選択</option>' +
      (C.TIME_SLOTS || []).map(function (t) { return "<option>" + t + "</option>"; }).join("");
  });

  // ---------- 日付の最短日 ----------
  var min = new Date();
  min.setDate(min.getDate() + (C.MIN_DAYS_AHEAD || 0));
  var minStr = min.getFullYear() + "-" + String(min.getMonth() + 1).padStart(2, "0") + "-" + String(min.getDate()).padStart(2, "0");
  $$('input[type="date"]').forEach(function (d) { d.min = minStr; });

  // ---------- URLパラメータから初期値（例: ?normal=2&set1=1） ----------
  var params = new URLSearchParams(location.search);
  $$("select.qty").forEach(function (sel) {
    var v = parseInt(params.get(sel.name), 10);
    if (v >= 0 && v <= (C.MAX_QTY || 10)) sel.value = String(v);
  });

  // ---------- 計算 ----------
  function getItems() {
    return $$("select.qty").map(function (sel) {
      var q = parseInt(sel.value, 10) || 0;
      var price = parseInt(sel.dataset.price, 10);
      var label = sel.closest(".row").querySelector(".row-name").childNodes;
      var name = Array.prototype.filter.call(label, function (n) { return n.nodeType === 3; })
        .map(function (n) { return n.textContent.trim(); }).join("");
      return { key: sel.name, name: name, qty: q, price: price, subtotal: q * price, isOpt: sel.classList.contains("opt") };
    });
  }

  function units() {
    return (parseInt(form.normal.value, 10) || 0) + (parseInt(form.cleaning.value, 10) || 0);
  }

  function render() {
    var items = getItems();
    var total = items.reduce(function (s, i) { return s + i.subtotal; }, 0);
    $("#total").textContent = yen(total);

    var picked = items.filter(function (i) { return i.qty > 0; });
    $("#lineItems").innerHTML = picked.length
      ? picked.map(function (i) {
          return "<li><span>" + i.name + " × " + i.qty + "台</span><span>" + yen(i.subtotal) + "</span></li>";
        }).join("") + '<li class="sum"><span>合計（税込・概算）</span><span>' + yen(total) + "</span></li>"
      : '<li class="empty">まだ何も選択されていません</li>';

    // オプション台数がエアコン台数を超えていないか
    var u = units();
    var over = items.filter(function (i) { return i.isOpt && i.qty > u; });
    var warn = $("#optWarn");
    if (over.length) {
      warn.hidden = false;
      warn.textContent = "「" + over.map(function (i) { return i.name; }).join("」「") + "」の台数がエアコンの台数（" + u + "台）より多くなっています。";
    } else { warn.hidden = true; }

    renderUnits(u);
    return { items: picked, total: total, units: u };
  }

  // ---------- エアコン情報（台数分の入力欄） ----------
  var unitCache = {};
  function renderUnits(u) {
    var box = $("#unitList");
    $$(".unit", box).forEach(function (el) {
      unitCache[el.dataset.i] = {
        place: $("[name=place]", el).value, maker: $("[name=maker]", el).value, model: $("[name=model]", el).value
      };
    });
    if (!u) { box.innerHTML = '<p class="empty">① で台数を選ぶと入力欄が表示されます。</p>'; return; }
    var html = "";
    for (var i = 1; i <= u; i++) {
      var c = unitCache[i] || {};
      html += '<div class="unit" data-i="' + i + '"><b>' + i + '台目</b>' +
        '<input name="place" placeholder="設置場所（例：リビング）" value="' + esc(c.place) + '">' +
        '<input name="maker" placeholder="メーカー（例：ダイキン）" value="' + esc(c.maker) + '">' +
        '<input name="model" placeholder="型番（わかれば）" value="' + esc(c.model) + '"></div>';
    }
    box.innerHTML = html;
  }
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  $$("select.qty").forEach(function (s) { s.addEventListener("change", render); });

  // ---------- 郵便番号 → 住所 ----------
  $("#zipLookup").addEventListener("click", function () {
    var zip = form.zip.value.replace(/[^0-9]/g, "");
    var st = $("#zipStatus");
    if (zip.length !== 7) { st.textContent = "郵便番号を7桁で入力してください。"; st.className = "status err"; return; }
    st.textContent = "検索中…"; st.className = "status";
    fetch("https://zipcloud.ibsnet.co.jp/api/search?zipcode=" + zip)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.results && j.results[0]) {
          var a = j.results[0];
          form.address.value = a.address1 + a.address2 + a.address3;
          form.address.focus();
          st.textContent = "住所を入力しました。番地・建物名を続けてご入力ください。"; st.className = "status ok";
        } else { st.textContent = "住所が見つかりませんでした。直接ご入力ください。"; st.className = "status err"; }
      })
      .catch(function () { st.textContent = "自動入力できませんでした。直接ご入力ください。"; st.className = "status err"; });
  });

  // ---------- 予約に進むボタン ----------
  $("#toBooking").addEventListener("click", function (e) {
    if (!units()) {
      e.preventDefault();
      form.normal.focus();
      form.normal.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  // ---------- 送信 ----------
  function fail(msg, el) {
    var st = $("#sendStatus");
    st.textContent = msg; st.className = "status err";
    if (el) { el.classList.add("invalid"); el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  form.addEventListener("input", function (e) { e.target.classList && e.target.classList.remove("invalid"); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var est = render();
    if (!est.units) return fail("① でエアコンの台数を選択してください。", form.normal);
    if (!$("#optWarn").hidden) return fail("オプションの台数がエアコンの台数を超えています。ご確認ください。", $("#optWarn"));

    var required = $$("[required]", form);
    for (var i = 0; i < required.length; i++) {
      var f = required[i];
      if (f.type === "checkbox" ? !f.checked : !f.value.trim()) {
        return fail("未入力の必須項目があります。", f);
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value)) return fail("メールアドレスの形式をご確認ください。", form.email);
    if (form.tel.value.replace(/[^0-9]/g, "").length < 10) return fail("電話番号をご確認ください。", form.tel);
    var dates = [1, 2, 3].map(function (n) { return form["date" + n].value + " " + form["time" + n].value; });
    if (new Set(dates).size < 3) return fail("第一〜第三希望は、それぞれ異なる日時を選んでください。", form.date2);

    var id = "AD" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var unitsInfo = $$("#unitList .unit").map(function (el) {
      return el.dataset.i + "台目: " + [$("[name=place]", el).value, $("[name=maker]", el).value, $("[name=model]", el).value].filter(Boolean).join(" / ");
    }).join("\n");

    var payload = {
      id: id,
      submittedAt: new Date().toLocaleString("ja-JP"),
      name: form.name.value, zip: form.zip.value, address: form.address.value,
      tel: form.tel.value, email: form.email.value,
      wish1: dates[0], wish2: dates[1], wish3: dates[2],
      parking: form.parking.value, payment: form.payment.value, visit: form.visit.value, pet: form.pet.value,
      units: est.units,
      items: est.items.map(function (i) { return i.name + " × " + i.qty + "台 = " + yen(i.subtotal); }).join("\n"),
      total: est.total,
      aircon: unitsInfo,
      notes: form.notes.value,
      company: form.company.value // スパム対策（空のはず）
    };

    var btn = $("#submitBtn");
    btn.disabled = true; btn.textContent = "送信中…";
    $("#sendStatus").textContent = ""; $("#sendStatus").className = "status";

    var send = C.ENDPOINT
      ? fetch(C.ENDPOINT, { method: "POST", mode: "no-cors", body: new URLSearchParams(payload) })
      : new Promise(function (res) { console.info("[テストモード] 送信内容", payload); setTimeout(res, 600); });

    send.then(function () {
      form.hidden = true;
      $("#totalbar").hidden = true;
      $("#done").hidden = false;
      $("#doneId").textContent = id + (C.ENDPOINT ? "" : "（テストモード：実際には送信されていません）");
      var line = $("#lineLink");
      if (C.LINE_URL) line.href = C.LINE_URL; else line.parentNode.hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function () {
      btn.disabled = false; btn.textContent = "この内容で予約を送信する";
      fail("送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。");
    });
  });

  render();
})();
