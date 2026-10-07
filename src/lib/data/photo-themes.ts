import type { Place } from "@/lib/types";
import { PH } from "./photos";

/**
 * Тема каждого стокового кадра. Нужна не интерфейсу, а проверке `npm run audit:photos`:
 * кадр на странице места должен быть про то, что в этом месте есть. Зоопарк не показывает театр,
 * музей транспорта — игрушечные лодки и колесо обозрения.
 * Запись обязательна для каждого ключа PH (иначе TypeScript не соберёт проект): новый кадр нельзя добавить «без темы».
 */
export type PhotoTheme =
  | "play" | "playground" | "kids" | "party"
  | "nature-museum" | "science" | "space" | "museum" | "military" | "train" | "transport"
  | "animals" | "aquarium" | "circus" | "theatre" | "puppets" | "film"
  | "park" | "estate" | "autumn" | "picnic" | "greenhouse" | "amusement" | "city"
  | "active" | "water" | "ice"
  | "art" | "books" | "shop" | "lego"
  | "cafe" | "food" | "rain";

type Key = keyof typeof PH;

const T = (theme: PhotoTheme, keys: Key[]): [PhotoTheme, Key[]] => [theme, keys];

const GROUPS: [PhotoTheme, Key[]][] = [
  T("play", ["balls", "slidesBallpit", "indoorPlay", "inflatableMall", "multicolorSlides", "playAreaSlide", "bounceHouse", "rubberDucks", "ballpitToddler", "ballsAssorted", "playroomTables", "playKitchen", "playKitchenWindow", "playMapFlags"]),
  T("playground", ["woodenPlayground", "colorfulPlayground", "redSlide", "boySwing", "girlSwing", "playgroundPark", "childClimbPlayground", "emptyPlaygroundRed", "boyOnSwing", "blueSlide", "helmetPlayground"]),
  T("kids", ["childLaughing", "girlGrass", "girlSweater", "boySmile"]),
  T("party", ["birthdayBalloons", "birthdayCake", "candlesKids", "toddlerCandles", "toddlerBalloons"]),
  T("nature-museum", ["dinoPeople", "dinoDisplay", "dinoSkeleton", "dinoCrowd", "dinoSkylight", "dinoHall", "whaleMuseum", "childDinoSkull", "skeletonAnimal", "crocodileSkeleton"]),
  T("science", ["plasmaBall", "labCoatGirl", "labKidsGroup", "microscopeGirl"]),
  T("space", ["rocketWarehouse", "rocketStatue", "shuttle", "spacecraft", "orangeRocket", "planetsDisplay", "domeBuilding"]),
  T("museum", ["galleryPeople", "museumHallward", "museumPeople", "statuesSkylight", "bigClock", "museumChildExhibit", "museumChildDisplay", "museumGirlPillars"]),
  T("military", ["armoredVehicle", "fighterJet", "wwiDiorama", "memorialFlags"]),
  T("train", ["trainSteam1", "trainSteam2"]),
  T("transport", ["tramYellow", "tramOrange", "tramLisbon"]),
  T("animals", [
    "giraffe", "giraffeTree", "giraffes", "giraffeSky", "redPanda", "redPandaClimb", "redPandaLog",
    "penguins", "penguinsGroup", "elephants", "elephantRiver", "zebra", "zebras", "macawsFlight", "boyParrot",
    "goatKid", "girlBabyGoat", "childPetsGoat", "goatsNoses", "whiteGoat",
    "girlHorse", "girlWhiteHorse", "ponyStable", "boyPony",
    "huskyBlueEyes", "huskyPuppy", "huskyAdult", "huskyDeck",
  ]),
  T("aquarium", ["aquariumTunnel", "aquariumTunnel2", "dolphins", "dolphinsLeap", "aquariumFish", "fishSchool", "sharks"]),
  T("circus", ["circusTent", "circusNight", "acrobat", "dogOnWheel", "clownJuggler", "aerialSilks", "circusTentBike"]),
  T("theatre", ["theaterOrnate", "theaterInterior", "theaterEmpty", "theaterAudience"]),
  T("puppets", ["frogPuppets", "marionette", "marionetteClown", "clownPuppet", "clownMarionette2", "masksPuppet"]),
  T("film", ["filmCrew", "filmCamera", "clapper"]),
  T("park", [
    "parkPath", "parkSun", "parkWalk", "parkLawn", "parkBench", "parkGreen", "bigTree", "fatherChildPark", "familyLake", "familyWalk",
    "parkPeople", "parkSteps", "fountainFlowers", "fountainPeople", "parkLakeBench", "parkLakeTrees", "parkGazebo", "parkAvenue",
    "forestPath", "forestSun", "parkBenchesRow", "treesGrass", "hillSunset", "fieldPeople", "benchTrees", "lawnTrees", "treeLinedStreet",
    "lawnPeople", "familyWoodsPath", "groupPath", "benchAlley", "motherChildRoad", "riverbankPath", "pavedPath", "treePath", "greenPond",
  ]),
  T("estate", ["estateRedPalace", "estateGreenRoof", "estateLake", "estateClock", "churchArch", "woodenHouse", "parkLawnBuilding", "estateGreenDome", "estateRoad", "estateStatue", "estateWhite"]),
  T("autumn", ["autumnPath", "childRunsAutumn", "autumnSkyline", "autumnPeoplePath"]),
  T("picnic", ["picnicFamily", "childrenCircle", "girlBucket", "picnicBlanket"]),
  T("greenhouse", ["greenhouse", "tropicalWaterfall", "greenhouseGlass", "bananaTrees", "greenhousePalm", "palmTree"]),
  T("amusement", ["ferrisBlue", "ferrisWhite", "ferrisRed", "amusementNight", "carouselHorse", "carouselBlue", "carouselNight", "carouselAnimals", "carouselCarriage", "rideCrowd"]),
  T("city", ["telescopeCity", "coinTelescope", "citySkyline", "moscowCityTower", "moscowNightTower", "moscowGoldenHigh"]),
  T("active", [
    "trampolineIndoor", "obstacleFoam", "trampolines", "trampolineStations", "bungeeTrampoline",
    "climbingWall", "childClimbing", "kidsClimb", "childrenClimbing", "childrenClimbingTall",
    "ropeBridge", "treehouseBridge", "ropesCourse", "forestBridge",
    "ropesBalanceBoy", "redRopeBridge", "ziplineChild", "ropeClimber",
  ]),
  T("water", ["waterpark", "waterparkFamily", "waterparkSlides", "waterPlayground", "girlPool", "kidsPool", "waterRedStairs", "waterRedStairs2", "inflatableWater", "inflatableWater2"]),
  T("ice", ["kidsSkating", "kidsHockey", "skatingPeople", "iceRink", "skatesCloseup", "figureSkater", "rinkGroup", "womanSkating"]),
  T("art", ["girlPainting", "boyWatercolor", "paintPlates", "paintbrush", "artKidStarry", "artKidBench", "kidsDrawingsWall"]),
  T("books", ["kidsBooks", "childrenReading", "libraryMomChild", "boyReading", "kidsShelf", "girlLibraryStairs", "childShelfRead", "girlsStairsReading"]),
  T("shop", ["toyWindow", "toyShelves", "toyBoats", "plushPastries", "toyStorePeople", "toyCloseup", "teddyBow", "teddyPink", "plushBasket", "teddies"]),
  T("lego", ["lego", "legoMany", "legoStack", "legoAssorted"]),
  T("cafe", [
    "cafeChildWindow", "cafeMomChild", "cafeStroller", "cafeBearHat", "girlFruitBowl", "cafeWood", "cafePlants", "cafeWarm", "cafeBooks",
    "kidsCorner", "childDrawingCafe", "childMenu", "girlTable", "girlsTalking", "restaurantLights", "roundTable",
  ]),
  T("food", [
    "pancakeBlueberry", "pancakesBerries", "pancakes", "pancakesStrawberry", "cupcake", "pizza", "pizzaLeaves", "pizzaTwo", "pizzaHand",
    "icecreamSprinkles", "icecreamThree", "icecreamCones", "icecreamPink", "icecreamHand", "icecreamStrawberry",
    "girlPancakes1", "girlPancakes2", "girlPancakes3", "foodCourtNight", "foodHallPeople", "foodTables",
    "chefHatKid", "doughnutGirl", "bakingKids", "doughTable", "muffinKids", "riceMeat",
  ]),
  T("rain", ["toddlerRainboots", "redBoots", "girlUmbrella", "childPinkRaincoat", "childYellowRaincoat", "childPuddle"]),
];

/** Полная таблица «кадр → тема». Ключ, пропущенный выше, ловит проверка (и тип ниже). */
export const PH_THEME: Record<Key, PhotoTheme> = (() => {
  const m = {} as Record<Key, PhotoTheme>;
  for (const [theme, keys] of GROUPS) for (const k of keys) m[k] = theme;
  return m;
})();

/** Обратно: src → ключ кадра (для проверок и подсказок). */
export const KEY_OF_SRC: ReadonlyMap<string, Key> = new Map((Object.entries(PH) as [Key, string][]).map(([k, v]) => [v, k]));

/* ───────────────────── какие темы уместны для места ───────────────────── */

const BY_CATEGORY: Record<Place["category"], PhotoTheme[]> = {
  park: ["park", "estate", "autumn", "picnic", "playground", "greenhouse", "amusement", "kids", "city"],
  play: ["play", "playground", "amusement", "kids", "party", "active"],
  museum: ["museum", "city"],
  active: ["active", "water", "ice", "kids"],
  animals: ["animals", "aquarium", "kids"],
  cafe: ["cafe", "food", "party", "play", "kids"],
  shop: ["shop", "books", "lego", "kids"],
};

const BY_TYPE: Partial<Record<NonNullable<Place["place_type"]>, PhotoTheme[]>> = {
  ice_rink: ["ice"],
  waterpark: ["water"],
  aquarium: ["aquarium"],
  theatre: ["theatre", "puppets"],
  circus: ["circus", "theatre"],
  landmark: ["city"],
  food_hall: ["food", "cafe"],
};

/** Что человек ждёт увидеть, если у места есть такой интерес. */
const BY_INTEREST: Partial<Record<string, PhotoTheme[]>> = {
  dinosaurs: ["nature-museum"],
  animals: ["animals", "aquarium", "nature-museum"],
  transport: ["transport", "train", "military"],
  sport: ["active", "ice", "water"],
  drawing: ["art", "kids"],
  music: ["theatre", "puppets"],
  science: ["science", "space", "nature-museum"],
  cooking: ["food", "cafe"],
  construction: ["lego", "transport"],
  nature: ["park", "greenhouse", "animals", "estate"],
  space: ["space", "science"],
  fairy: ["puppets", "theatre", "kids"],
};

const BY_EXPERIENCE: Partial<Record<string, PhotoTheme[]>> = {
  playzone: ["play"],
  cafe: ["cafe", "food"],
  workshop: ["art", "kids", "food"],
  show: ["theatre", "puppets", "circus"],
  walk: ["park"],
  icecream: ["food"],
  toys: ["shop"],
  books: ["books"],
  food: ["food", "cafe"],
  picnic: ["picnic", "park"],
};

/** Точечные исключения: место сочетает несколько тем, которые не видны по категории и тегам. */
export const EXTRA_THEMES: Record<string, PhotoTheme[]> = {
  "ugolok-durova": ["animals", "circus"],
  "muzey-igrushki-sergiev-posad": ["shop"],
  "kolomna-muzey-lyubimoy-igrushki": ["shop"],
  "muzey-materinstva-ilinskoe": ["books", "shop"],
  "muzey-nazad-v-sssr-zvenigorod": ["shop"],
  "muzey-lozhki-solnechnogorsk": ["art", "shop"],
  "muzey-lego-lets-go-zvenigorod": ["lego"],
  "muzey-russkogo-deserta-zvenigorod": ["food"],
  "kolomna-pastila-muzey": ["food"],
  "izmailovsky-kreml": ["estate", "shop"],
  "ostankino-usadba": ["estate", "park"],
  "dom-muzey-prishvina-dunino": ["books", "autumn", "park"],
  "dom-muzey-vasnecova": ["art"],
  "park-patriot-kubinka": ["military"],
  "politehnichesky-muzey": ["space", "science"],
  "muzey-pobedy": ["military"],
  "borodinskaya-panorama": ["military"],
  "muzey-tekhniki-zadorozhnogo": ["military", "transport", "train"],
  "zoomuzey-msu": ["animals"],
  "teatr-nash-dom-khimki": ["books"],
  vdnh: ["amusement", "space"],
  "ostrov-mechty": ["amusement"],
  "park-zaryadye": ["greenhouse"],
  "dom-knigi-arbat": ["books"],
  "biblio-globus": ["books"],
  "kidzania-aviapark": ["kids"],
  "mosfilm-excursion": ["film"],
  "jooie-presnya": ["art"],
  "dream-kids": ["art"],
  "piratskaya-ploshchadka": ["playground"],
};

/** Допустимые темы кадров для места. */
export function allowedThemes(p: Pick<Place, "slug" | "category" | "place_type" | "interest_tags" | "experience_tags">): Set<PhotoTheme> {
  const out = new Set<PhotoTheme>(BY_CATEGORY[p.category]);
  // у кафе-ресторана и фудхолла тема — еда; «специальные» типы заменяют категорию, а не дополняют её
  const typed = p.place_type ? BY_TYPE[p.place_type] : undefined;
  if (typed) {
    if (p.category === "museum" || p.category === "active" || p.category === "animals") out.clear();
    for (const t of typed) out.add(t);
  }
  for (const i of p.interest_tags) for (const t of BY_INTEREST[i] ?? []) out.add(t);
  for (const e of p.experience_tags) for (const t of BY_EXPERIENCE[e] ?? []) out.add(t);
  for (const t of EXTRA_THEMES[p.slug] ?? []) out.add(t);
  return out;
}
