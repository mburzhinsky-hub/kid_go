/**
 * Проверка правил отправки в Яндекс Метрику (src/lib/metrika.ts).
 * Главное: возрасты детей из адреса результатов подбора и личные хотелки никогда не уходят в Метрику.
 *   npx tsx scripts/test-metrika.ts
 */
import assert from "node:assert/strict";
import { YM_ID, cleanHitUrl, cleanReferrer, isPrivatePath, isTrackedHost } from "../src/lib/metrika";

const O = "https://kids-go.fun";

// счётчик
assert.equal(YM_ID, 113672662);

// только боевой домен
assert.ok(isTrackedHost("kids-go.fun") && isTrackedHost("www.kids-go.fun") && isTrackedHost("KIDS-GO.FUN"));
for (const h of ["localhost", "127.0.0.1", "mburzhinsky-hub.github.io", "kids-go.fun.evil.com", "evilkids-go.fun"]) assert.ok(!isTrackedHost(h), h);

// параметры адреса отбрасываются, в том числе возрасты детей
const planner = "?kids=3~7&duration=half&mood=active&budget=mid&transport=car&weather=sun&anchor=kuskovo";
assert.equal(cleanHitUrl(O, "/planner/results", planner, true), O + "/planner/results");
assert.equal(cleanHitUrl(O, "/planner/results", planner, false), O + "/planner/results");
assert.ok(!cleanHitUrl(O, "/planner/results", planner, true).includes("kids="));
assert.equal(cleanHitUrl(O, "/search", "?q=с+ребёнком+3+лет", true), O + "/search");

// рекламные метки сохраняются, но только с первым просмотром и только utm_*
const utm = "?utm_source=tg&utm_medium=social&utm_campaign=week-2026-10-17&kids=3&cr=abc&utm_content=" + "x".repeat(300);
const kept = new URL(cleanHitUrl(O, "/", utm, true));
assert.equal(kept.searchParams.get("utm_source"), "tg");
assert.equal(kept.searchParams.get("utm_campaign"), "week-2026-10-17");
assert.equal(kept.searchParams.get("kids"), null);
assert.equal(kept.searchParams.get("cr"), null);
assert.equal((kept.searchParams.get("utm_content") ?? "").length, 100);
assert.equal(cleanHitUrl(O, "/", utm, false), O + "/");
assert.equal(cleanHitUrl(O, "/kuda-shodit/s-malyshom/", "", true), O + "/kuda-shodit/s-malyshom/");

// закрытые разделы
for (const p of ["/admin", "/admin/events", "/cabinet", "/cabinet/places", "/import", "/profile", "/api/x"]) assert.ok(isPrivatePath(p), p);
for (const p of ["/", "/places/kuskovo", "/planner/results", "/privacy", "/importance", "/profiles-of-places"]) assert.ok(!isPrivatePath(p), p);

// реферер: свои страницы без query, чужие как есть, мусор пропадает
assert.equal(cleanReferrer(O + "/planner/results?kids=3~7", O), O + "/planner/results");
assert.equal(cleanReferrer("https://t.me/somechannel/12", O), "https://t.me/somechannel/12");
assert.equal(cleanReferrer("", O), "");
assert.equal(cleanReferrer("not a url", O), "");

console.log("Metrika rules passed: адреса без параметров, utm только первым заходом, закрытые разделы не отправляются");
