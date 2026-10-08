/**
 * Сторож загрузки: крошечный скрипт, который выполняется до приложения.
 * Если за 12 секунд приложение не запустилось (не загрузился файл, упал скрипт, всё «висит»), вместо белого экрана
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
function btn(label,fn){var b=document.createElement("button");b.textContent=label;
b.style.cssText="font:600 16px system-ui,sans-serif;margin:8px 8px 0 0;padding:12px 18px;border-radius:999px;border:1px solid #bbb;background:#fff;color:#111";
b.onclick=fn;return b}
function show(){if(ready||panel)return;
var p=document.createElement("div");
p.style.cssText="position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;overflow:auto;background:#faf8f4;color:#1d1b1a;padding:24px 20px;font:16px/1.4 system-ui,-apple-system,sans-serif";
var h=document.createElement("h1");h.textContent="Страница грузится дольше обычного";h.style.cssText="font-size:22px;margin:8px 0";p.appendChild(h);
var t=document.createElement("p");t.textContent="Подождите ещё немного или нажмите «Обновить». Если не помогает — «Сбросить и обновить». Если и это не помогло, пришлите нам этот экран.";p.appendChild(t);
var pend=pending(),lines=["Адрес: "+location.href,"Прошло: "+Math.round((Date.now()-t0)/1000)+" с","Онлайн: "+navigator.onLine,"Браузер: "+navigator.userAgent];
if(errs.length){lines.push("","Ошибки:");errs.forEach(function(x){lines.push("• "+x)})}
if(pend.length){lines.push("","Ещё не загрузились файлы:");pend.slice(0,10).forEach(function(x){lines.push("• "+x)})}
var pre=document.createElement("pre");pre.textContent=lines.join("\\n");
pre.style.cssText="white-space:pre-wrap;word-break:break-word;font:12px/1.4 ui-monospace,Menlo,monospace;background:rgba(128,128,128,.12);padding:12px;border-radius:12px";p.appendChild(pre);
p.appendChild(btn("Обновить",function(){location.reload()}));
p.appendChild(btn("Сбросить и обновить",function(){
var jobs=[];
try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}))}catch(e){}
try{if(window.caches)jobs.push(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}))}catch(e){}
Promise.all(jobs).then(function(){location.reload()},function(){location.reload()});
setTimeout(function(){location.reload()},2500)}));
var a=document.createElement("a");a.href="/diag/";a.textContent="Открыть проверку соединения";a.style.cssText="display:block;margin-top:18px;color:#c2185b;font-weight:600";p.appendChild(a);
panel=p;document.body.appendChild(p)}
setTimeout(show,12000);
})();`;
