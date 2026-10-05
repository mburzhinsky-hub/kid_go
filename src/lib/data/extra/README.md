# Формат файлов с местами (`*.places.json`) и афишей (`*.events.json`)

Файлы лежат рядом, подхватываются автоматически (`src/lib/data/extra.ts`). Один файл = JSON-массив.
Правило №1: **только реально существующие места**, которые удалось подтвердить поиском (сайт заведения, карты, Википедия).
Не знаешь точно — пропусти место. Ничего не выдумывай: ни адреса, ни часы, ни цены, ни рейтинги.

## Место

```json
{
  "title": "Усадьба «Архангельское»",
  "slug": "arkhangelskoe",
  "town": "Красногорск",
  "region": "mo",
  "address": "Московская область, Красногорск, п. Архангельское",
  "metro": "Пятницкое шоссе (для Москвы — ближайшая станция метро, иначе опусти поле)",
  "lat": 55.7845,
  "lng": 37.2836,
  "category": "park",
  "place_type": "park",
  "subtitle": "Усадьба-музей и парк на реке",
  "description": "2–3 предложения: что здесь делать с детьми. Без рекламных выдумок.",
  "price": [0, 500],
  "family_budget": 1500,
  "age": [0, 12],
  "duration": 150,
  "indoor": false,
  "outdoor": true,
  "activity": 2,
  "noise": 1,
  "stroller": true,
  "baby_room": false,
  "kids_menu": true,
  "parking": true,
  "toilets": true,
  "wardrobe": false,
  "booking": false,
  "hours": ["10:00-19:00", "10:00-19:00", "10:00-19:00", "10:00-19:00", "10:00-19:00", "10:00-19:00", "10:00-19:00"],
  "season": ["spring", "summer", "autumn", "winter"],
  "weather": ["sun", "any"],
  "interests": ["nature", "animals"],
  "experience": ["walk", "picnic", "cafe"],
  "tags": ["Парк", "Река", "С коляской"],
  "hit": false,
  "photoSet": "park",
  "rating": null,
  "reviews": null,
  "rating_source": null,
  "source": "https://…",
  "confidence": "high"
}
```

Поля и допустимые значения
- `region`: `"msk"` (в границах Москвы, включая Зеленоград и Новую Москву) или `"mo"` (Московская область). `town` — город/посёлок/район.
- `category` — широкая продуктовая группа для текущих фильтров: `park | play | museum | active | animals | cafe | shop`. Театры и цирки могут оставаться в широкой группе `museum` для совместимости, но обязательно получают точный `place_type`.
- `place_type` — точный тип: `park | play_center | museum | active | zoo | aquarium | cafe | restaurant | shop | bookstore | theatre | circus | workshop | landmark | heritage | food_hall | ice_rink | waterpark | other`.
- `lat`/`lng`: десятичные градусы, точность до ~300 м (по адресу/карточке на картах/Википедии). Москва: lat 55.3–56.1, lng 36.9–38.3; область: lat 54.6–56.9, lng 35.1–40.3.
- `price`: [минимум, максимум] ₽ на одного человека за вход/активность; бесплатно — [0,0]. Это ориентир, округляй до 50 ₽.
- `family_budget`: во сколько обычно обходится визит семьи 2+2, ₽ (оценка).
- `age`: [от, до] лет, для кого реально интересно и безопасно; максимум 12.
- `duration`: типичная длительность визита, минут (30–360).
- `activity`/`noise`: 1 спокойно · 2 умеренно · 3 активно/шумно.
- `hours`: 7 элементов, понедельник → воскресенье; `"ЧЧ:ММ-ЧЧ:ММ"` или `null` (выходной). Круглосуточно — `"00:00-24:00"`. Парк без режима — `"06:00-23:00"`. Если режим меняется по сезону — дай зимний/осенний (актуальный на октябрь).
- `season`: когда место уместно (`spring|summer|autumn|winter`); `weather`: `rain|sun|cold|heat|any` — когда место хорошо подходит (под крышей → `rain`,`cold`,`any`; на улице → `sun`,`any`; аквапарк/тень → `heat`).
- `interests` (макс. 3) ⊂ `dinosaurs animals transport sport drawing music science cooking construction nature space fairy`.
- `experience` ⊂ `playzone cafe workshop show walk icecream toys books food picnic unusual free toddlers`.
- `tags`: 3–5 коротких чипов («Контактный зоопарк», «От 1 года», «Парковка»).
- `photoSet` — ключ тематического набора стоковых фото (фото иллюстративные, не самого места): `park autumn playground picnic farm pony zoo aquarium dino space science museum play trampoline climbing ropes waterpark ice art theatre cafe pancakes pizza icecream toys lego books ferris greenhouse rain`.
- `rating` и `reviews` (число отзывов): **только если видел реальные цифры** на конкретной карточке карт/сайте, иначе `null`. При ненулевом рейтинге обязателен `rating_source` — URL именно той страницы, где видны эти цифры. Без `rating_source` рейтинг в публичном интерфейсе скрывается. Отзывы текстом не придумывай.
- `source`: ссылка, по которой подтверждено существование (и по возможности режим/цены). `confidence`: `high` (источник подтверждает имя, адрес и основные операционные сведения) · `medium` (место точно есть, а режим/цены/часть удобств ориентировочные) · `low` — такое не публикуем.
- Не подменяй неизвестное значением `false`. Для необязательных family-полей (`stroller`, `baby_room`, `kids_menu`, `parking`, `toilets`, `wardrobe`, `booking`) **пропусти поле**, если источник его не подтверждает. Слой данных пометит его как «не уточнено».
- Стоковые `photoSet` — только иллюстрации тематики. Они не являются фотографиями конкретного объекта и в UI должны быть маркированы как иллюстративные.
- `slug` — латиница, kebab-case, уникальный.

## Событие / регулярная программа (`*.events.json`)

Только регулярные программы, которые реально проходят в заведении (еженедельные мастер-классы, шоу, кормления, «дни открытых дверей» и т.п.), без выдуманных дат.

```json
{
  "venue": "moskovsky-zoopark",
  "title": "Кормление пингвинов",
  "description": "Одно-два предложения.",
  "schedule": { "days": [1,2,3,4,5,6,7], "from": "11:30", "to": "12:00" },
  "age": [0, 12],
  "price": 0,
  "photoSet": "zoo",
  "source": "https://…",
  "confidence": "high"
}
```
`days`: 1 = понедельник … 7 = воскресенье. `venue` — slug существующего места (из `places.ts` или из любого `*.places.json`). Если нужного места нет в базе — добавь его в свой `*.places.json`.
