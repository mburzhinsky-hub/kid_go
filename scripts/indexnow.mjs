// Сообщает Яндексу о страницах сайта по протоколу IndexNow: node scripts/indexnow.mjs [--dry]
// Берёт адреса из боевой sitemap.xml. Ключ — файл public/<32 символа>.txt (он публичный и лежит на сайте: так поисковик убеждается, что мы владельцы).
// Запускается из GitHub Actions (workflow indexnow): из рабочей среды разработки внешние сайты недоступны.
import { readdirSync, readFileSync } from "node:fs";

const HOST = "kids-go.fun";
const dry = process.argv.includes("--dry");

const keyFile = readdirSync("public").find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("нет файла ключа public/<32 hex>.txt");
const key = readFileSync(`public/${keyFile}`, "utf8").trim();
if (keyFile !== `${key}.txt`) throw new Error("содержимое файла ключа не совпадает с его именем");
const keyLocation = `https://${HOST}/${keyFile}`;

// 1. ключ должен открываться на боевом сайте, иначе Яндекс отклонит отправку
const k = await fetch(keyLocation, { redirect: "manual" });
const kText = (await k.text()).trim();
console.log(`ключ на сайте: ${k.status}, совпадает: ${kText === key}`);
if (k.status !== 200 || kText !== key) throw new Error("файл ключа на боевом сайте не открывается или отличается: сначала выложите сайт");

// 2. адреса из карты сайта
const sm = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => new URL(u).host === HOST);
console.log(`адресов в sitemap.xml: ${urls.length}`);
if (!urls.length) throw new Error("пустая карта сайта");
if (dry) process.exit(0);

// 3. отправка (до 10 000 адресов за раз)
const r = await fetch("https://yandex.com/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key, keyLocation, urlList: urls }),
});
console.log(`Яндекс ответил: ${r.status} ${r.statusText}`, (await r.text()).slice(0, 300));
// 200 и 202 — принято; 400 — неверный запрос; 403 — ключ не подтверждён; 422 — адреса не с нашего домена; 429 — слишком часто
if (![200, 202].includes(r.status)) process.exit(1);
