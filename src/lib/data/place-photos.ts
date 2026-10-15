import type { Photo, PhotoCredit, Place } from "@/lib/types";
import { COMMONS_PREFIX } from "@/lib/commons";
import { partnerSrc } from "@/lib/partner";
import raw from "./place-photos.json";
import partnerRaw from "./partner-photos.json";

/**
 * Настоящие фотографии мест — из Wikimedia Commons (свободные лицензии, автор указывается на странице места).
 * Данные: place-photos.json, slug → кадры. Подбирались по названию, адресу и координатам и просматривались глазами;
 * в файл попадает только то, что действительно снято в этом месте. Один и тот же снимок не используется у двух мест
 * (это проверяет `npm run audit:photos`).
 *
 * Поля кадра: f — имя файла на Commons, i — id своей копии на хостинге (public/photos/<i>-…),
 * w — ширина оригинала, a — автор, l — лицензия.
 */
export interface RealPhoto {
  f: string;
  i: string;
  w: number;
  a: string;
  l: string;
}

export const REAL_PHOTOS = raw as unknown as Record<string, RealPhoto[]>;

/**
 * Фото, которые прислали сами места (с их согласия), — partner-photos.json, slug → {автор, сайт, кадры}.
 * Копии лежат в public/partner/ (их делает scripts/add-partner-photo.mjs), подпись под галереей — «Фото: <автор>».
 * Поля кадра: f — имя исходного файла, i — id копии (pt-<хеш имени файла>), w — ширина оригинала, alt — что на снимке.
 */
export interface PartnerPhoto {
  f: string;
  i: string;
  w: number;
  alt: string;
}
export interface PartnerPhotoSet {
  /** Кто прислал и кого указываем автором, например «Музей «Назад в СССР»». */
  author: string;
  /** Сайт места: на него ведёт подпись. */
  url: string;
  /** Как сказать, откуда снимки: «предоставлены музеем». Идёт после автора в подписи под галереей. */
  note: string;
  photos: PartnerPhoto[];
}

export const PARTNER_PHOTOS = partnerRaw as unknown as Record<string, PartnerPhotoSet>;

/** Подпись фото от места: автор — ссылка на сайт места, без лицензии Creative Commons. */
export const partnerCredit = (set: PartnerPhotoSet): PhotoCredit => ({ author: set.author, license: set.note, url: set.url, kind: "partner" });

/**
 * Чем заменять фото места, у которого настоящих снимков пока нет.
 * false — честная иллюстрация (цвет и значок категории): чужие и «похожие» стоковые кадры не выдаём за это место.
 * true  — прежнее поведение: подборка стоковых кадров по типу места (так делать не стоит, они повторяются у разных мест).
 */
export const STOCK_FALLBACK = false;

/** Ссылка на текст лицензии. У общественного достояния её нет. */
export function licenseUrl(l: string): string | undefined {
  const m = /^CC BY(-SA)? (\d\.\d)$/.exec(l);
  if (m) return `https://creativecommons.org/licenses/by${m[1] ? "-sa" : ""}/${m[2]}/`;
  if (l === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  return undefined;
}

/** Страница файла на Commons: автор, история загрузки и лицензия в оригинале. */
export const commonsPageUrl = (file: string) => `https://commons.wikimedia.org/wiki/File:${file.replace(/\?/g, "%3F").replace(/#/g, "%23")}`;

export function creditOf(p: RealPhoto): PhotoCredit {
  return { author: p.a, license: p.l, licenseUrl: licenseUrl(p.l), url: commonsPageUrl(p.f) };
}

/** Адрес снимка в данных (см. lib/commons.ts): имя файла и id своей копии. */
export const commonsSrc = (p: RealPhoto) => `${COMMONS_PREFIX}${encodeURIComponent(p.f)}?lid=${p.i}`;

function realPhotos(place: Place): Photo[] {
  // сначала фото, которые прислало само место (они свежее и точнее), потом снимки с Commons
  const set = PARTNER_PHOTOS[place.slug];
  const own: Photo[] = set ? set.photos.map((p) => ({ src: partnerSrc(p.i), alt: p.alt, kind: "partner" as const, credit: partnerCredit(set) })) : [];
  const list = REAL_PHOTOS[place.slug] ?? [];
  const commons: Photo[] = list.map((p, i) => ({
    src: commonsSrc(p),
    alt: i === 0 && !own.length ? place.title : `${place.title}, фото ${own.length + i + 1}`,
    kind: "commons" as const,
    credit: creditOf(p),
  }));
  return [...own, ...commons];
}

/** Единственный кадр-заглушка: SmartImage рисует вместо него иллюстрацию (цвет и значок места). */
const noPhoto = (place: Place): Photo[] => [{ src: "", alt: place.title, kind: "demo" }];

/** Подставляет месту его настоящие фото. Остальным — иллюстрация (или стоковые кадры при STOCK_FALLBACK). */
export function applyRealPhotos(place: Place): Place {
  const real = realPhotos(place);
  if (real.length) return { ...place, photos: real };
  return STOCK_FALLBACK ? place : { ...place, photos: noPhoto(place) };
}
