<?php
declare(strict_types=1);

// Страница модератора: /api/moderation.php. Это только оболочка — данных и секретов в ней нет, всё читается через /api/v1/admin/…
// с токеном, который владелец вводит вручную (хранится в sessionStorage до закрытия вкладки). Страница закрыта от поисковиков и кэша.
$nonce = rtrim(strtr(base64_encode(random_bytes(16)), '+/', '-_'), '=');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; script-src 'nonce-$nonce'; style-src 'nonce-$nonce'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
?>
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Модерация · Kids Go</title>
<style nonce="<?= $nonce ?>">
  :root { --bg:#faf8f4; --surface:#fff; --ink:#1d1b1a; --muted:#6f6a64; --line:#e8e4dc; --pink:#e5457f; --green:#1f8a4c; --red:#c62d2d; --amber:#9a6b00; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161413; --surface:#211e1c; --ink:#f3efe9; --muted:#a39d95; --line:#38332f; --pink:#ff6a9e; --green:#4cc27f; --red:#ff7b7b; --amber:#e6b84a; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:16px 16px 64px; }
  h1 { font-size:24px; margin:8px 0 4px; }
  .muted { color:var(--muted); font-size:14px; }
  .bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:14px 0; }
  button, .btn { font:inherit; font-weight:600; border:0; border-radius:999px; padding:9px 16px; background:var(--surface); color:var(--ink); box-shadow:0 0 0 1px var(--line); cursor:pointer; text-decoration:none; display:inline-block; }
  button.on { background:var(--ink); color:var(--bg); }
  button.primary { background:var(--pink); color:#fff; box-shadow:none; }
  button.danger { color:var(--red); }
  button.good { color:var(--green); }
  button:disabled { opacity:.5; cursor:default; }
  input[type=text], input[type=password] { font:inherit; width:100%; padding:11px 14px; border-radius:14px; border:1px solid var(--line); background:var(--surface); color:var(--ink); }
  .card { background:var(--surface); border-radius:20px; padding:14px 16px; margin:12px 0; box-shadow:0 0 0 1px var(--line); }
  .card h2 { font-size:18px; margin:0 0 4px; overflow-wrap:anywhere; }
  .chips { display:flex; gap:6px; flex-wrap:wrap; margin:6px 0; }
  .chip { font-size:13px; font-weight:600; border-radius:999px; padding:3px 10px; background:var(--bg); box-shadow:0 0 0 1px var(--line); }
  .chip.red { color:var(--red); } .chip.green { color:var(--green); } .chip.amber { color:var(--amber); }
  .desc { white-space:pre-wrap; overflow-wrap:anywhere; margin:6px 0; }
  ul { margin:6px 0; padding-left:20px; } li { margin:2px 0; overflow-wrap:anywhere; }
  .note { border-left:3px solid var(--line); padding:2px 10px; margin:6px 0; overflow-wrap:anywhere; }
  .acts { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .msg { padding:10px 14px; border-radius:14px; margin:10px 0; background:var(--surface); box-shadow:0 0 0 1px var(--line); }
  .msg.err { color:var(--red); }
  .row { display:flex; gap:8px; } .row input { flex:1; }
  .right { margin-left:auto; }
</style>
</head>
<body>
<main id="app"></main>
<script nonce="<?= $nonce ?>">
"use strict";
(() => {
  const API = "/api/v1/admin";
  const KEY = "kg-mod-token";
  const REASONS = { inappropriate: "Неприемлемое содержание", impersonation: "Выдаёт себя за другого", spam: "Спам или реклама", children: "Данные или фото детей", other: "Другое" };
  const STATUS = { DRAFT: "Черновик", PUBLISHED: "Опубликована", HIDDEN: "Скрыта" };
  const VIS = { PUBLIC: "публичная", UNLISTED: "по ссылке", PRIVATE: "приватная" };
  const app = document.getElementById("app");
  let token = "";
  try { token = sessionStorage.getItem(KEY) || ""; } catch (e) { /* без хранилища токен живёт до обновления страницы */ }
  let tab = "NEW";

  // put: добавить в элемент узлы и тексты; null/false пропускаются, массивы разворачиваются (родной append() напечатал бы «null»)
  const put = (el, ...kids) => {
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  };
  const h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : String(v));
    }
    return put(el, kids);
  };
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const when = (iso) => { try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); } catch (e) { return iso; } };

  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(API + path, { method, headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    } catch (e) { throw new Error("Нет связи с сервером"); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* не JSON */ }
    if (res.status === 403) { const err = new Error("Неверный токен"); err.auth = true; throw err; }
    if (res.status === 429) throw new Error("Слишком много попыток. Подождите 15 минут.");
    if (!res.ok) throw new Error((data && data.error && data.error.message) || "Ошибка " + res.status);
    return data;
  }

  function logout() { token = ""; try { sessionStorage.removeItem(KEY); } catch (e) {} render(); }

  function login(msg) {
    clear(app);
    const input = h("input", { type: "password", placeholder: "Служебный токен", autocomplete: "off", "aria-label": "Служебный токен" });
    const out = h("div");
    const go = async () => {
      token = input.value.trim();
      if (!token) return;
      try {
        await call("GET", "/reports");
        try { sessionStorage.setItem(KEY, token); } catch (e) {}
        render();
      } catch (e) { token = ""; clear(out); out.append(h("div", { class: "msg err" }, e.message)); }
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    put(app, h("h1", null, "Модерация Kids Go"), h("p", { class: "muted" }, "Введите служебный токен. Он не сохраняется на сервере и забывается при закрытии вкладки."),
      msg ? h("div", { class: "msg err" }, msg) : null, h("div", { class: "row" }, input, h("button", { class: "primary", onclick: go }, "Войти")), out);
    input.focus();
  }

  // ───────── карточки
  function chip(text, cls) { return h("span", { class: "chip " + (cls || "") }, text); }

  function collectionCard(card, onChange) {
    const c = card.collection, a = card.author, r = card.reports;
    const box = h("div", { class: "card" });
    const status = c.status === "HIDDEN" ? chip(c.hidden_by === "AUTO" ? "Скрыта автоматически" : "Скрыта модератором", "red")
      : c.status === "PUBLISHED" ? chip("Опубликована", "green") : chip(STATUS[c.status] || c.status, "amber");
    const reasons = Object.entries(r.reasons || {}).map(([k, n]) => chip((REASONS[k] || k) + ": " + n, "amber"));
    put(box,
      h("h2", null, c.title),
      h("div", { class: "chips" }, status, chip(VIS[c.visibility] || c.visibility), chip(c.city), c.reviewed ? chip("проверена", "green") : null,
        chip("@" + a.handle + (a.status === "SUSPENDED" ? " · заблокирован" : ""), a.status === "SUSPENDED" ? "red" : "")),
      c.description ? h("p", { class: "desc" }, c.description) : null,
      c.items.length ? h("ul", null, c.items.map((i) => h("li", null, i.place_id + (i.note ? " — «" + i.note + "»" : "")))) : h("p", { class: "muted" }, "Мест нет"),
      h("p", { class: "muted" }, r.count ? "Жалоб: " + r.count + (r.last_at ? " · последняя " + when(r.last_at) : "") : "Открытых жалоб нет"),
      reasons.length ? h("div", { class: "chips" }, reasons) : null,
      r.notes.map((n) => h("div", { class: "note" }, h("span", { class: "muted" }, (REASONS[n.reason] || n.reason) + " · " + when(n.at) + ": "), n.note))
    );
    const acts = h("div", { class: "acts" });
    const act = (label, cls, fn, ask) => acts.append(h("button", { class: cls || "", onclick: async (e) => {
      if (ask && !confirm(ask)) return;
      const btn = e.currentTarget; btn.disabled = true;
      try { await fn(); } catch (err) { if (err.auth) return login(err.message); alert(err.message); btn.disabled = false; }
    } }, label));
    const post = async (path) => { const next = await call("POST", path, {}); onChange(next); };
    acts.append(h("a", { class: "btn", href: c.path, target: "_blank", rel: "noopener noreferrer" }, "Открыть"));
    if (c.status === "PUBLISHED") act("Скрыть", "danger", () => post("/collections/" + c.id + "/hide"), "Скрыть подборку «" + c.title + "»?");
    if (c.status === "HIDDEN") act("Вернуть", "good", () => post("/collections/" + c.id + "/restore"));
    if (r.count) act("Отклонить жалобы", "", () => post("/collections/" + c.id + "/dismiss"));
    act("Все подборки автора", "", async () => { tab = "FIND"; render(); showAuthor(a.handle); });
    act(a.status === "SUSPENDED" ? "Разблокировать автора" : "Заблокировать автора", a.status === "SUSPENDED" ? "good" : "danger", async () => {
      await call("POST", "/authors/" + encodeURIComponent(a.handle) + (a.status === "SUSPENDED" ? "/unsuspend" : "/suspend"), {});
      onChange(await call("GET", "/collections/" + c.id));
    }, a.status === "SUSPENDED" ? null : "Заблокировать @" + a.handle + "? Автор не сможет войти, а все его подборки пропадут.");
    box.append(acts);
    return box;
  }

  // ───────── вкладки
  const list = h("div");
  function tabs() {
    const t = (id, label) => h("button", { class: tab === id ? "on" : "", onclick: () => { tab = id; render(); } }, label);
    return h("div", { class: "bar" }, t("NEW", "Очередь"), t("DONE", "Разобранные"), t("FIND", "Найти"), h("button", { class: "right", onclick: logout }, "Выйти"));
  }

  async function showQueue(status) {
    clear(list);
    list.append(h("p", { class: "muted" }, "Загрузка…"));
    try {
      const data = await call("GET", "/reports?status=" + status);
      clear(list);
      if (!data.items.length) list.append(h("p", { class: "muted" }, status === "NEW" ? "Новых жалоб нет." : "Разобранных жалоб пока нет."));
      for (const it of data.items) {
        const slot = h("div");
        const draw = (card) => { clear(slot); slot.append(collectionCard(card, draw)); };
        draw(it);
        list.append(slot);
      }
    } catch (e) { if (e.auth) return login(e.message); clear(list); list.append(h("div", { class: "msg err" }, e.message)); }
  }

  async function showAuthor(handle) {
    clear(list);
    try {
      const data = await call("GET", "/authors/" + encodeURIComponent(handle));
      const a = data.author;
      const head = h("div", { class: "card" }, h("h2", null, a.name + " · @" + a.handle),
        h("div", { class: "chips" }, chip(a.status === "SUSPENDED" ? "Заблокирован" : "Активен", a.status === "SUSPENDED" ? "red" : "green")));
      const toggle = h("button", { class: a.status === "SUSPENDED" ? "good" : "danger", onclick: async () => {
        if (a.status !== "SUSPENDED" && !confirm("Заблокировать @" + a.handle + "? Автор не сможет войти, а все его подборки пропадут.")) return;
        try { await call("POST", "/authors/" + encodeURIComponent(a.handle) + (a.status === "SUSPENDED" ? "/unsuspend" : "/suspend"), {}); showAuthor(a.handle); }
        catch (e) { if (e.auth) return login(e.message); alert(e.message); }
      } }, a.status === "SUSPENDED" ? "Разблокировать" : "Заблокировать");
      head.append(h("div", { class: "acts" }, toggle));
      list.append(head);
      if (!data.collections.length) list.append(h("p", { class: "muted" }, "Подборок нет."));
      for (const c of data.collections) {
        list.append(h("div", { class: "card" }, h("h2", null, c.title),
          h("div", { class: "chips" }, chip(STATUS[c.status] || c.status, c.status === "HIDDEN" ? "red" : ""), chip(VIS[c.visibility] || c.visibility), c.open_reports ? chip("жалоб: " + c.open_reports, "amber") : null),
          h("div", { class: "acts" }, h("button", { onclick: () => showCollection(c.id) }, "Открыть карточку"))));
      }
    } catch (e) { if (e.auth) return login(e.message); list.append(h("div", { class: "msg err" }, e.message)); }
  }

  async function showCollection(id) {
    clear(list);
    try {
      const slot = h("div");
      const draw = (card) => { clear(slot); slot.append(collectionCard(card, draw)); };
      draw(await call("GET", "/collections/" + id));
      list.append(slot);
    } catch (e) { if (e.auth) return login(e.message); list.append(h("div", { class: "msg err" }, e.message)); }
  }

  function find() {
    const input = h("input", { type: "text", placeholder: "Ссылка на подборку, её код или ник автора", autocomplete: "off", autocapitalize: "off", "aria-label": "Ссылка, код или ник" });
    const go = () => {
      const v = input.value.trim();
      if (!v) return;
      const m = v.match(/\/c\/([a-z0-9]{10})(?:[\/?#]|$)/) || v.match(/[?&]id=([a-z0-9]{10})(?:&|$)/) || v.match(/^([a-z0-9]{10})$/);
      if (m) return showCollection(m[1]);
      const handle = v.replace(/^.*\/@/, "").replace(/^@/, "").toLowerCase();
      showAuthor(handle);
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return h("div", { class: "row" }, input, h("button", { class: "primary", onclick: go }, "Найти"));
  }

  function render() {
    if (!token) return login();
    clear(app);
    clear(list);
    app.append(h("h1", null, "Модерация"), h("p", { class: "muted" }, "Три жалобы от разных людей скрывают подборку автоматически. Здесь её можно проверить: вернуть, оставить скрытой или заблокировать автора."), tabs());
    if (tab === "FIND") app.append(find());
    app.append(list);
    if (tab !== "FIND") showQueue(tab);
  }

  render();
})();
</script>
</body>
</html>
