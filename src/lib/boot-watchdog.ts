/**
 * Сторож загрузки: крошечный скрипт, который выполняется до приложения.
 * Если за 15 секунд приложение не запустилось (не загрузился файл, упал скрипт, всё «висит»), вместо белого экрана
 * показываем причину и кнопки «Обновить» / «Сбросить и обновить». Приложение сообщает «я запустилось» через window.__kgReady().
 * Написан на простом JS без современного синтаксиса: должен работать в любом браузере, даже там, где основной код не запустится.
 */
export const BOOT_WATCHDOG = `(function(){
var errs=[],ready=false,panel=null,t0=Date.now();
function add(s){s=String(s).slice(0,240);if(errs.length<10&&errs.indexOf(s)<0)errs.push(s)}
window.addEventListener("error",function(e){var t=e.target;
if(t&&t!==window&&(t.src||t.href))add("Не загрузился файл: "+(t.src||t.href));
else add((e.message||"Ошибка")+(e.filename?" ["+String(e.filename).split("/").pop()+":"+e.lineno+"]":""))},true);
window.addEventListener("unhandledrejection",function(e){var r=e.reason;add("Ошибка: "+((r&&r.message)||r))});
window.__kgReady=function(){ready=true;if(panel&&panel.parentNode)panel.parentNode.removeChild(panel);panel=null};
function pending(){var done={},out=[],s=document.scripts,i;
try{performance.getEntriesByType("resource").forEach(function(r){done[r.name]=1})}catch(e){}
for(i=0;i<s.length;i++)if(s[i].src&&s[i].src.indexOf("/_next/")>0&&!done[s[i].src])out.push(s[i].src.split("/").pop());
return out}
function btn(label,fn,main){var b=document.createElement("button");b.textContent=label;
b.style.cssText="display:block;width:100%;font:700 17px system-ui,-apple-system,sans-serif;margin:12px 0 0;padding:15px 18px;border-radius:999px;border:0;"+(main?"background:#ff2e88;color:#fff":"background:#efece6;color:#1d1b1a");
b.onclick=fn;return b}
function show(){if(ready||panel)return;
var p=document.createElement("div");
p.style.cssText="position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;overflow:auto;background:#fbfaf7;color:#1d1b1a;padding:48px 24px 24px;font:16px/1.45 system-ui,-apple-system,sans-serif;text-align:center";
var box=document.createElement("div");box.style.cssText="max-width:420px;margin:0 auto";p.appendChild(box);
var em=document.createElement("div");em.textContent="\uD83D\uDC22";em.style.cssText="font-size:56px;line-height:1";box.appendChild(em);
var h=document.createElement("h1");h.textContent="Что-то долго грузится";h.style.cssText="font-size:26px;line-height:1.15;margin:16px 0 8px;font-weight:800";box.appendChild(h);
var t=document.createElement("p");t.textContent="Проверьте интернет и нажмите «Обновить». Если не поможет — «Начать заново»: ваши хотелки и дети сохранятся.";t.style.cssText="margin:0 0 8px;color:#5f5a54";box.appendChild(t);
box.appendChild(btn("Обновить",function(){location.reload()},true));
box.appendChild(btn("Начать заново",function(){
var jobs=[];
try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}))}catch(e){}
try{if(window.caches)jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}))}catch(e){}
Promise.all(jobs).then(function(){location.reload()},function(){location.reload()});
setTimeout(function(){location.reload()},2500)}));
var pend=pending(),lines=["Адрес: "+location.href,"Прошло: "+Math.round((Date.now()-t0)/1000)+" с","Интернет: "+(navigator.onLine?"есть":"нет"),"Браузер: "+navigator.userAgent];
if(errs.length){lines.push("","Ошибки:");errs.forEach(function(x){lines.push("• "+x)})}
if(pend.length){lines.push("","Не загрузились файлы:");pend.slice(0,10).forEach(function(x){lines.push("• "+x)})}
var d=document.createElement("details");d.style.cssText="margin-top:28px;text-align:left;color:#8a847d;font-size:13px";
var sm=document.createElement("summary");sm.textContent="Подробности для поддержки";sm.style.cssText="cursor:pointer;text-align:center";d.appendChild(sm);
var pre=document.createElement("pre");pre.textContent=lines.join("\\n");
pre.style.cssText="white-space:pre-wrap;word-break:break-word;font:12px/1.4 ui-monospace,Menlo,monospace;background:rgba(128,128,128,.1);padding:12px;border-radius:12px;margin:10px 0 0";d.appendChild(pre);
var a=document.createElement("a");a.href="/diag/";a.textContent="Проверить соединение";a.style.cssText="display:block;margin-top:10px;text-align:center;color:#c2185b;font-weight:600";d.appendChild(a);
box.appendChild(d);
panel=p;document.body.appendChild(p)}
setTimeout(show,15000);
})();`;
