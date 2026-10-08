/**
 * Первый заход: чтобы новичок не видел «на полсекунды» главную, а потом внезапное знакомство.
 *
 * Приложение понимает, что заход первый, только после запуска (хранилище семьи читается уже в браузере), а главная рисуется раньше.
 * Поэтому крошечный скрипт в самом начале страницы заранее смотрит в localStorage и, если это первый заход на главную,
 * ставит на <html> метку data-first: заставка (#kg-splash в layout.tsx) закрывает экран ещё до первой отрисовки.
 * Метку снимает Providers — когда знакомство открылось (или выяснилось, что оно не нужно); в крайнем случае — по таймеру.
 *
 * Условия те же, что в Providers: главная, в этой вкладке знакомство ещё не показывали, детей нет и знакомство не пройдено.
 * Написан на простом JS без современного синтаксиса и ничего не ломает: любая ошибка (закрытое хранилище и т. п.) — заставки просто нет.
 */
export const FIRST_VISIT_ATTR = "data-first";
/** Метка вкладки «знакомство уже показывали» (sessionStorage) — общая для скрипта и Providers. */
export const ONBOARDING_SHOWN_KEY = "kidgo-onb-shown";
const FAMILY_KEY = "kidgo-family";

export const firstVisitScript = (basePath: string) => `(function(){try{
var p=location.pathname,b=${JSON.stringify(basePath)};
if(b&&p.indexOf(b)===0)p=p.slice(b.length);
while(p.length>1&&p.charAt(p.length-1)==="/")p=p.slice(0,-1);
if(p!==""&&p!=="/")return;
if(sessionStorage.getItem("${ONBOARDING_SHOWN_KEY}"))return;
var raw=localStorage.getItem("${FAMILY_KEY}"),first=true;
if(raw){var s=(JSON.parse(raw)||{}).state||{};first=!s.onboarded&&!(s.children&&s.children.length)}
if(first)document.documentElement.setAttribute("${FIRST_VISIT_ATTR}","1")
}catch(e){}})();`;

/** Убирает заставку (плавно: см. #kg-splash в globals.css). */
export function hideSplash() {
  try {
    document.documentElement.removeAttribute(FIRST_VISIT_ATTR);
  } catch {
    /* noop */
  }
}
