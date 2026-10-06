/**
 * Редакторский слой доверия для старого curated seed.
 *
 * До Block 1 этот набор смешивал реальные места и демонстрационные сущности.
 * В production публикуем только записи, для которых есть проверяемый публичный источник.
 * Динамические поля (цены/часы) всё равно требуют повторной проверки со временем.
 */
export type TrustConfidence = "high" | "medium" | "demo" | "osm";

export interface PlaceTrust {
  source?: string;
  sourceName?: string;
  verifiedAt?: string;
  confidence: TrustConfidence;
  note?: string;
}

const VERIFIED_AT = "2026-10-05";

export const BASE_PLACE_TRUST: Record<string, PlaceTrust> = {
  "joki-joya": {
    source: "https://joki-joya.ru/",
    sourceName: "Joki Joya",
    verifiedAt: VERIFIED_AT,
    confidence: "medium",
    note: "Существование сети подтверждено; тарифы и конкретный филиал требуют актуализации перед визитом.",
  },
  "piratskaya-ploshchadka": {
    source: "https://vk.com/@gorkypark-igrovye-ploschadki-v-neskuchnom-sadu-chast-1",
    sourceName: "Парк Горького",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
    note: "Площадка «Стройка» и ориентир входа подтверждены официальной публикацией Парка Горького.",
  },
  "park-sokolniki": {
    source: "https://parksokolniki.mos.ru/",
    sourceName: "Парк Сокольники",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "park-gorkogo": {
    source: "https://parkgorkogo.ru/",
    sourceName: "Парк Горького",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "park-zaryadye": {
    source: "https://welcome.zaryadyepark.ru/",
    sourceName: "Парк Зарядье",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "kolomenskoe": {
    source: "https://mgomz.ru/kolomenskoe",
    sourceName: "МГОМЗ «Коломенское»",
    verifiedAt: VERIFIED_AT,
    confidence: "medium",
  },
  "aptekarsky-ogorod": {
    source: "https://hortus.msu.ru/",
    sourceName: "Аптекарский огород МГУ",
    verifiedAt: VERIFIED_AT,
    confidence: "medium",
  },
  "vdnh": {
    source: "https://vdnh.ru/",
    sourceName: "ВДНХ",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "paleontologichesky-muzey": {
    source: "https://www.paleo.ru/museum/visitors/",
    sourceName: "Палеонтологический музей им. Ю. А. Орлова",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "muzey-kosmonavtiki": {
    source: "https://kosmo-museum.ru/",
    sourceName: "Музей космонавтики",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "darvinovsky-muzey": {
    source: "https://www.darwinmuseum.ru/",
    sourceName: "Государственный Дарвиновский музей",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "eksperimentanium": {
    source: "https://experimentanium.ru/",
    sourceName: "Экспериментаниум",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "moskovsky-planetariy": {
    source: "https://planetarium-moscow.ru/",
    sourceName: "Московский планетарий",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "muzey-transporta": {
    source: "https://mtmuseum.ru/",
    sourceName: "Музей Транспорта Москвы",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "moskovsky-zoopark": {
    source: "https://moscowzoo.ru/",
    sourceName: "Московский зоопарк",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "moskvarium": {
    source: "https://moskvarium.ru/",
    sourceName: "Москвариум",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "skalodrom-skala-siti": {
    source: "https://www.skala-city.ru/",
    sourceName: "Скала Сити",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },
  "panda-park-sokolniki": {
    source: "https://pandapark.org/",
    sourceName: "ПандаПарк",
    verifiedAt: VERIFIED_AT,
    confidence: "medium",
  },
  "centralny-detsky-magazin": {
    source: "https://cdm-moscow.ru/",
    sourceName: "Центральный Детский Магазин",
    verifiedAt: VERIFIED_AT,
    confidence: "high",
  },

  // Демонстрационные записи старого прототипа: не публикуются в production-каталоге.
  "skazochny-les": { confidence: "demo", note: "Не удалось подтвердить объект по указанному адресу и описанию." },
  "myagkaya-strana-pufik": { confidence: "demo", note: "Демонстрационная запись." },
  "gorodok-masterov": { confidence: "demo", note: "Не подтверждён объект с указанным адресом и набором услуг." },
  "kontaktny-zoopark-ushastiki": { confidence: "demo", note: "Не подтверждён объект с указанным адресом." },
  "poni-klub-podkova": { confidence: "demo", note: "По адресу находится другой конноспортивный объект." },
  "batutny-centr-pryg-skok": { confidence: "demo", note: "Демонстрационная запись." },
  "katok-snezhinka": { confidence: "demo", note: "Не подтверждён объект с указанным адресом." },
  "akvapark-volna": { confidence: "demo", note: "Аквапарк с таким названием и адресом в Москве не подтверждён." },
  "kafe-ponchik": { confidence: "demo", note: "Демонстрационная запись." },
  "piccerija-malenkiy-shef": { confidence: "demo", note: "Демонстрационная запись." },
  "kafe-morozhenoe-plombir": { confidence: "demo", note: "Демонстрационная запись." },
  "blinnaya-ladushki": { confidence: "demo", note: "Демонстрационная запись." },
  "kafe-zelyony-slon": { confidence: "demo", note: "Демонстрационная запись." },
  "kofeynya-sovushka": { confidence: "demo", note: "Демонстрационная запись." },
  "kafe-oblaka": { confidence: "demo", note: "Демонстрационная запись." },
  "igrushechnaya-lavka-dinozavrik": { confidence: "demo", note: "Демонстрационная запись." },
  "konstruktorskaya-kirpichik": { confidence: "demo", note: "Демонстрационная запись." },
  "knizhny-chitay-ka": { confidence: "demo", note: "Демонстрационная запись." },
  "masterskaya-akvarelka": { confidence: "demo", note: "Демонстрационная запись." },
};

export function trustForBasePlace(slug: string): PlaceTrust {
  return BASE_PLACE_TRUST[slug] ?? {
    confidence: "demo",
    note: "Запись не прошла редакторскую верификацию Block 1.",
  };
}

export function isPublishableBasePlace(slug: string) {
  return trustForBasePlace(slug).confidence !== "demo";
}
