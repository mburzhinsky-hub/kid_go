import type { Photo } from "@/lib/types";

/**
 * Реестр демо-фотографий (Unsplash, бесплатная лицензия, hotlink через imgix CDN).
 * В проде заменяется на собственное хранилище (Supabase Storage / S3) —
 * достаточно поменять базовый URL в image-loader.
 */
const U = (id: string) => `https://images.unsplash.com/${id}`;

export const PH = {
  // игровые пространства
  balls: U("photo-1760727408754-c5c9ef169f8d"),
  slidesBallpit: U("photo-1759330203240-b89ccee8840f"),
  indoorPlay: U("photo-1780932333368-4995b2e14174"),
  inflatableMall: U("photo-1786114403532-06b35a8c5fe6"),
  multicolorSlides: U("photo-1576501084684-9e18f00769b8"),
  playAreaSlide: U("photo-1720729706612-040e610e611c"),
  bounceHouse: U("photo-1765947389633-461a4af7712b"),
  rubberDucks: U("photo-1785502355036-86157516f701"),
  // площадки
  woodenPlayground: U("photo-1596997000103-e597b3ca50df"),
  colorfulPlayground: U("photo-1552537595-b30edb7afd9d"),
  redSlide: U("photo-1634608874538-443b84f7b06b"),
  boySwing: U("photo-1460788150444-d9dc07fa9dba"),
  girlSwing: U("photo-1593103916129-87e179a70c1f"),
  playgroundPark: U("photo-1784026823207-c4da5cc774bb"),
  childClimbPlayground: U("photo-1786453732257-0802e72f8fab"),
  emptyPlaygroundRed: U("photo-1780980702219-b13b1dff57dd"),
  // дети / эмоции
  childLaughing: U("photo-1517832207067-4db24a2ae47c"),
  girlGrass: U("photo-1498674202614-ac0172c6c61a"),
  girlSweater: U("photo-1624272949900-9ae4c56397e8"),
  boySmile: U("photo-1552873816-636e43209957"),
  // музеи
  dinoPeople: U("photo-1513038630932-13873b1a7f29"),
  dinoDisplay: U("photo-1710795723705-f1af3905ae3a"),
  dinoSkeleton: U("photo-1548980386-58fc3e0b377e"),
  dinoCrowd: U("photo-1553338258-24fe91e8baf3"),
  dinoSkylight: U("photo-1638172603656-d7d9b064a3b1"),
  dinoHall: U("photo-1678376446728-61236ddf0087"),
  whaleMuseum: U("photo-1508026155071-961dae008723"),
  childDinoSkull: U("photo-1768154576965-61e5776268a7"),
  plasmaBall: U("photo-1778513599495-6bba02a83e39"),
  rocketWarehouse: U("photo-1515272751348-25380c6c1f9c"),
  rocketStatue: U("photo-1730110987360-513bb7f20427"),
  shuttle: U("photo-1519241678948-28f18681ce14"),
  spacecraft: U("photo-1745773620897-e6666b641de3"),
  orangeRocket: U("photo-1649605551149-526a96a130a5"),
  // животные
  giraffe: U("photo-1574870111867-089730e5a72b"),
  giraffeTree: U("photo-1543716778-1b10caf74fb8"),
  giraffes: U("photo-1567107961174-1f142419567a"),
  giraffeSky: U("photo-1599846883095-e98e3de3731c"),
  redPanda: U("photo-1656899367728-cf0194bf3aeb"),
  redPandaClimb: U("photo-1538099130811-745e64318258"),
  redPandaLog: U("photo-1463436755683-3f805a9d1192"),
  aquariumTunnel: U("photo-1769234428281-c108a6053cd3"),
  aquariumTunnel2: U("photo-1790038366847-0f7b46200995"),
  dolphins: U("photo-1777693485251-a3821f2b8905"),
  dolphinsLeap: U("photo-1777448812169-87c81fb36970"),
  aquariumFish: U("photo-1689913576489-d6ad6d949328"),
  fishSchool: U("photo-1709570125779-c8d5fcce2a8a"),
  sharks: U("photo-1767284089224-073e5dc24e37"),
  goatKid: U("photo-1643552164007-16be33d15e29"),
  girlBabyGoat: U("photo-1750234395815-7a334ec8a926"),
  childPetsGoat: U("photo-1776911693442-49557ff244d1"),
  goatsNoses: U("photo-1790715040233-e8f454b3d02c"),
  whiteGoat: U("photo-1499115421298-dc3b4fe66c58"),
  girlHorse: U("photo-1613387937499-3aa38e2c36c4"),
  girlWhiteHorse: U("photo-1507065282747-afce6cd90e84"),
  ponyStable: U("photo-1764889743960-b886cfeb943e"),
  boyPony: U("photo-1776127839787-649512e5a80d"),
  // парки
  parkPath: U("photo-1690065587467-d0e0f6d778de"),
  parkSun: U("photo-1641357441057-e798d0af9ed8"),
  parkWalk: U("photo-1728717832210-311f016165cb"),
  parkLawn: U("photo-1702209285989-56fd5968979b"),
  parkBench: U("photo-1718786628241-b8287f6d3158"),
  parkGreen: U("photo-1783788357963-4ca219fe9da8"),
  bigTree: U("photo-1786718040378-332512dc74ea"),
  fatherChildPark: U("photo-1728750556070-5796f8948bef"),
  familyLake: U("photo-1760874363730-591f66c25546"),
  autumnPath: U("photo-1762256268969-0f54c5c1111d"),
  childRunsAutumn: U("photo-1774722397452-a58a23000461"),
  familyWalk: U("photo-1768569750194-eee0892bc7d6"),
  picnicFamily: U("photo-1681311311317-a0561a8eef74"),
  childrenCircle: U("photo-1627764940620-90393d0e8c34"),
  girlBucket: U("photo-1617855080812-2d84e040ef70"),
  picnicBlanket: U("photo-1719759336550-4fecc23ab176"),
  ferrisBlue: U("photo-1692301311188-bda319576dd1"),
  ferrisWhite: U("photo-1558638734-cd3e93651f81"),
  ferrisRed: U("photo-1614259191821-764847fde18b"),
  amusementNight: U("photo-1502137914655-3ab2fb4dc4cc"),
  greenhouse: U("photo-1713305298073-0c5d481bf381"),
  tropicalWaterfall: U("photo-1721640715397-b8717aaeb6a4"),
  greenhouseGlass: U("photo-1718219611264-3d541956ecda"),
  bananaTrees: U("photo-1624027543361-d98545cf2ff2"),
  greenPond: U("photo-1622818171279-fe0b6a336835"),
  // активный отдых
  trampolineIndoor: U("photo-1751235640841-d8d1035a80f0"),
  obstacleFoam: U("photo-1751235600651-94bbbeb29567"),
  trampolines: U("photo-1751235604534-f07bf076d690"),
  trampolineStations: U("photo-1751235641041-d5037f5ceb87"),
  bungeeTrampoline: U("photo-1784489312776-19af103a822e"),
  climbingWall: U("photo-1659666287295-7da26c3f80d4"),
  childClimbing: U("photo-1774885370242-1c9c77093513"),
  kidsClimb: U("photo-1549057736-889b732754a2"),
  childrenClimbing: U("photo-1776081696967-57bc9eaac5ce"),
  childrenClimbingTall: U("photo-1763702269921-49362114b35a"),
  ropeBridge: U("photo-1777931606108-1268f1dc4014"),
  treehouseBridge: U("photo-1759106219589-ba827d49f1a4"),
  ropesCourse: U("photo-1768350329806-2fea7b97e142"),
  forestBridge: U("photo-1634652029172-dba38fcd4c2d"),
  waterpark: U("photo-1790699591318-3e51966ea13c"),
  waterparkFamily: U("photo-1790699591366-0f5046d52839"),
  waterparkSlides: U("photo-1790699592170-adb0882d48b2"),
  waterPlayground: U("photo-1787825672720-75dcc003caa2"),
  girlPool: U("photo-1621176280827-ec238e17285e"),
  kidsPool: U("photo-1583227248528-726f9b22a454"),
  kidsSkating: U("photo-1528828465856-0ac27ee2aeb3"),
  kidsHockey: U("photo-1582484122761-676393e8626b"),
  skatingPeople: U("photo-1575808433605-aafc277c4d19"),
  iceRink: U("photo-1707125052614-2b9a178768a5"),
  // творчество
  girlPainting: U("photo-1512253080918-79cf0c2e0650"),
  boyWatercolor: U("photo-1536221993589-9edbbca2c7fc"),
  paintPlates: U("photo-1632494057327-c492dccde461"),
  paintbrush: U("photo-1698340311456-77454d0abdc7"),
  frogPuppets: U("photo-1785098058893-f5353872a6e5"),
  marionette: U("photo-1789871749228-aea137d15477"),
  // кафе и еда
  cafeChildWindow: U("photo-1782827928696-21ac88a51ace"),
  cafeMomChild: U("photo-1788946858958-949e1ffa13d4"),
  cafeStroller: U("photo-1764023874636-d1ab24d634a9"),
  cafeBearHat: U("photo-1788407429348-1648e5f4e024"),
  girlFruitBowl: U("photo-1615723412368-65806eaac24f"),
  cafeWood: U("photo-1691067987594-b1b7f84ba55a"),
  cafePlants: U("photo-1719581228610-b04fa23d3d26"),
  cafeWarm: U("photo-1751956066306-c5684cbcf385"),
  cafeBooks: U("photo-1750040970096-31907e42d6a5"),
  pancakeBlueberry: U("photo-1528207776546-365bb710ee93"),
  pancakesBerries: U("photo-1612182062633-9ff3b3598e96"),
  pancakes: U("photo-1541288097308-7b8e3f58c4c6"),
  pancakesStrawberry: U("photo-1598214886806-c87b84b7078b"),
  cupcake: U("photo-1587339144367-f1cacbecac82"),
  pizza: U("photo-1574071318508-1cdbab80d002"),
  pizzaLeaves: U("photo-1598023696416-0193a0bcd302"),
  pizzaTwo: U("photo-1571997478779-2adcbbe9ab2f"),
  pizzaHand: U("photo-1600028068383-ea11a7a101f3"),
  icecreamSprinkles: U("photo-1629385701021-fcd568a743e8"),
  icecreamThree: U("photo-1629385697093-57be2cc97fa6"),
  icecreamCones: U("photo-1589378884250-431463f05637"),
  icecreamPink: U("photo-1587563974670-b5181b459b30"),
  icecreamHand: U("photo-1718810125230-e8e2271354f5"),
  icecreamStrawberry: U("photo-1496533141630-d6731a403292"),
  // магазины
  toyWindow: U("photo-1741389544696-0750a7ac6bbb"),
  toyShelves: U("photo-1760612887223-95afcf5ab08f"),
  toyBoats: U("photo-1769072385160-0c414621aff9"),
  plushPastries: U("photo-1762352612385-231b079aa8d5"),
  toyStorePeople: U("photo-1647715416645-258437cf091e"),
  toyCloseup: U("photo-1644416598043-11c2816eec28"),
  teddyBow: U("photo-1556012018-50c5c0da73bf"),
  teddyPink: U("photo-1588090644556-14707d0e886a"),
  plushBasket: U("photo-1654959245667-ab62c8d00c26"),
  teddies: U("photo-1671888801949-f146b8c1a668"),
  lego: U("photo-1587654780291-39c9404d746b"),
  legoMany: U("photo-1633469924738-52101af51d87"),
  legoStack: U("photo-1644175897056-50f4d3a9a827"),
  legoAssorted: U("photo-1543878636-41918458581d"),
  kidsBooks: U("photo-1716324339623-384495f47373"),
  childrenReading: U("photo-1532789339108-2ebc484efbf1"),
  libraryMomChild: U("photo-1583468982228-19f19164aee2"),
  boyReading: U("photo-1540151812223-c30b3fab58e6"),
  // погода
  toddlerRainboots: U("photo-1554995783-571a2b4d923a"),
  redBoots: U("photo-1516658908390-30039e1d09d5"),
  girlUmbrella: U("photo-1697204120925-4852eb4bb48f"),
  childPinkRaincoat: U("photo-1788712424983-c61191832f33"),
  childYellowRaincoat: U("photo-1758535291260-d02ee9ae1ceb"),
  childPuddle: U("photo-1735990685776-f1f661dc806f"),
  // кафе, еда, детские праздники
  kidsCorner: U("photo-1780792082841-ced20d44e3e8"),
  childDrawingCafe: U("photo-1776142519519-8683165acf1f"),
  childMenu: U("photo-1760267967877-43e9806b023c"),
  girlPancakes1: U("photo-1762353242703-22c848bf01a9"),
  girlPancakes2: U("photo-1762353206866-ddca4322718f"),
  girlPancakes3: U("photo-1762353232634-fa95640ac388"),
  girlTable: U("photo-1679056058174-63d5f7e35dcf"),
  girlsTalking: U("photo-1770584848343-31fe3d130dcb"),
  restaurantLights: U("photo-1759692072092-d109f5a85c61"),
  roundTable: U("photo-1766812782166-e243111f703d"),
  foodCourtNight: U("photo-1771574208044-bc8a4836f59b"),
  foodHallPeople: U("photo-1695182035717-d71ef5b30d84"),
  foodTables: U("photo-1651449815995-9419a04685aa"),
  birthdayBalloons: U("photo-1741969494307-55394e3e4071"),
  birthdayCake: U("photo-1688632107202-7902806ff3d4"),
  candlesKids: U("photo-1608790672275-309c02d888ff"),
  toddlerCandles: U("photo-1516668557604-c8e814fdb184"),
  toddlerBalloons: U("photo-1766770301468-0fff596420b0"),
  chefHatKid: U("photo-1678285901330-bb80e5432cd5"),
  doughnutGirl: U("photo-1634393305859-dfb151e2fd54"),
  bakingKids: U("photo-1713942589752-6c6bb58ca8b6"),
  doughTable: U("photo-1630464061996-f09350430e86"),
  muffinKids: U("photo-1703132797372-5540c306436b"),
  riceMeat: U("photo-1634324092526-91f5e878b72f"),
  // музеи и галереи
  artKidStarry: U("photo-1787801004904-55eba5d06dd8"),
  artKidBench: U("photo-1791192210133-12a9c1170716"),
  kidsDrawingsWall: U("photo-1761403942462-04b8b97f1fe9"),
  galleryPeople: U("photo-1759922511738-df4ff12cfd6a"),
  armoredVehicle: U("photo-1695120972968-21ffead317fb"),
  fighterJet: U("photo-1695120973813-4b88ceeec938"),
  wwiDiorama: U("photo-1756507176200-86956fda9e9b"),
  memorialFlags: U("photo-1746254038350-9632e6ce6002"),
  museumHallward: U("photo-1696694139314-e0e5962b8dc0"),
  museumPeople: U("photo-1709144281351-b8068f51541e"),
  statuesSkylight: U("photo-1649452843752-663493034117"),
  bigClock: U("photo-1657623876124-e4755969a428"),
  skeletonAnimal: U("photo-1661108181859-c7932252796b"),
  crocodileSkeleton: U("photo-1596461290378-fedec9d6f52d"),
  trainSteam1: U("photo-1543967625-f24827a5fdb8"),
  trainSteam2: U("photo-1514759815569-dec9934ce933"),
  // цирк, театр, кино
  circusTent: U("photo-1678270852355-7f2bbbe8811e"),
  circusNight: U("photo-1631898721805-899a71dc384a"),
  acrobat: U("photo-1542732935-0750da3c04b5"),
  theaterOrnate: U("photo-1651437524278-b37b83a6e6d3"),
  theaterInterior: U("photo-1539964604210-db87088e0c2c"),
  theaterEmpty: U("photo-1771911654088-36080143c3bd"),
  theaterAudience: U("photo-1727416694673-6c8c0d95f2ee"),
  filmCrew: U("photo-1612544409025-e1f6a56c1152"),
  filmCamera: U("photo-1471341971476-ae15ff5dd4ea"),
  clapper: U("photo-1515634928627-2a4e0dae3ddf"),
  // города и смотровые
  telescopeCity: U("photo-1743153861132-476606305cbe"),
  coinTelescope: U("photo-1602817195903-af34694abfb0"),
  citySkyline: U("photo-1669348139292-6f1c353eac97"),
  // хаски
  huskyBlueEyes: U("photo-1568572933382-74d440642117"),
  huskyPuppy: U("photo-1617895153857-82fe79adfcd4"),
  huskyAdult: U("photo-1563889362352-b0492c224f62"),
  huskyDeck: U("photo-1550973078-ce53733d6117"),
  // парки и усадьбы
  parkPeople: U("photo-1650126719604-f6bedf3cb633"),
  parkSteps: U("photo-1684135383432-ae1f28cbd414"),
  fountainFlowers: U("photo-1671696564906-612750999288"),
  fountainPeople: U("photo-1671696564807-d0069fa4349d"),
  autumnSkyline: U("photo-1748324535858-fe0c5671f64b"),
  carouselHorse: U("photo-1566385658229-28bbe5ceee03"),
  parkLakeBench: U("photo-1704905833829-97d44101bc0a"),
  parkLakeTrees: U("photo-1704905833846-935db915cf69"),
  parkGazebo: U("photo-1704905834675-fed281f6f5bf"),
  parkAvenue: U("photo-1704905833908-b03323a1a8e8"),
  forestPath: U("photo-1682190636017-8ff088ae0bda"),
  forestSun: U("photo-1682190637434-2fca92f69860"),
  estateRedPalace: U("photo-1674470667758-12b41d204c9d"),
  estateGreenRoof: U("photo-1674470668058-f75db0b51cb2"),
  estateLake: U("photo-1674470667583-bca5ab7db04a"),
  estateClock: U("photo-1674470668117-787aedfb60bb"),
  churchArch: U("photo-1682190634065-b74789cf96de"),
  woodenHouse: U("photo-1756731316473-eba212cf0e5a"),
  parkLawnBuilding: U("photo-1747372685861-aeaaf68f15b2"),
  parkBenchesRow: U("photo-1668009219418-4ece0d9e36c4"),
  treesGrass: U("photo-1621661514271-48da9d48580f"),
  hillSunset: U("photo-1752658801043-bb7ee69073f7"),
  fieldPeople: U("photo-1561958501-4ef9547c43f9"),
  benchTrees: U("photo-1623593419606-7f9c8c22d736"),
  lawnTrees: U("photo-1696079196661-a5cbfb884255"),
  treeLinedStreet: U("photo-1687951367359-6c269e75c77f"),
  lawnPeople: U("photo-1723482255177-98b44112b573"),
  familyWoodsPath: U("photo-1758962036781-c0dc907aea7b"),
  groupPath: U("photo-1675345771255-733034aff5a2"),
  benchAlley: U("photo-1728594121610-5967ce03a6ab"),
  autumnPeoplePath: U("photo-1770346923752-f04a0b20f565"),
  motherChildRoad: U("photo-1688713658343-68b132822277"),
  riverbankPath: U("photo-1776586264945-b41b670f0991"),
  pavedPath: U("photo-1775478950062-fff456082152"),
  treePath: U("photo-1778069718364-82fb4b2bd610"),
} as const;

export const ph = (src: string, alt: string): Photo => ({ src, alt, kind: "stock" });

/** Тематические наборы стоковых фото для записей из JSON (иллюстрации, не фото самого места). */
export const PHOTO_SETS: Record<string, { keys: (keyof typeof PH)[]; alt: string }> = {
  park: {
    keys: ["parkPath", "parkLakeBench", "parkPeople", "parkWalk", "parkAvenue", "parkLawn", "parkSteps", "parkBench", "forestPath", "parkGreen", "fatherChildPark", "parkLakeTrees", "familyLake", "forestSun", "bigTree", "fountainPeople", "greenPond", "parkGazebo", "fountainFlowers", "parkSun", "parkBenchesRow", "treesGrass", "hillSunset", "fieldPeople", "benchTrees", "lawnTrees", "treeLinedStreet", "lawnPeople", "familyWoodsPath", "groupPath", "benchAlley", "motherChildRoad", "riverbankPath", "pavedPath", "treePath"],
    alt: "Парк",
  },
  estate: { keys: ["estateRedPalace", "parkLakeBench", "estateGreenRoof", "parkLakeTrees", "estateLake", "parkGazebo", "churchArch", "estateClock", "parkAvenue", "parkLawnBuilding", "forestSun", "forestPath", "parkLawn", "lawnTrees"], alt: "Усадьба и парк" },
  autumn: { keys: ["autumnPath", "childRunsAutumn", "autumnSkyline", "autumnPeoplePath", "familyWalk", "parkSun", "parkWalk", "parkBench"], alt: "Осенняя прогулка" },
  playground: { keys: ["woodenPlayground", "colorfulPlayground", "redSlide", "boySwing", "girlSwing", "playgroundPark", "childClimbPlayground", "emptyPlaygroundRed"], alt: "Детская площадка" },
  picnic: { keys: ["picnicFamily", "picnicBlanket", "childrenCircle", "girlGrass"], alt: "Пикник на траве" },
  farm: { keys: ["goatKid", "girlBabyGoat", "childPetsGoat", "goatsNoses", "whiteGoat"], alt: "Контактная ферма" },
  pony: { keys: ["girlHorse", "girlWhiteHorse", "ponyStable", "boyPony"], alt: "Лошади и пони" },
  zoo: { keys: ["giraffe", "giraffeTree", "giraffes", "giraffeSky", "redPanda", "redPandaClimb", "redPandaLog"], alt: "Животные" },
  aquarium: { keys: ["aquariumTunnel", "aquariumTunnel2", "dolphins", "aquariumFish", "fishSchool", "sharks"], alt: "Аквариум" },
  dino: { keys: ["dinoPeople", "dinoDisplay", "dinoSkeleton", "dinoCrowd", "dinoSkylight", "dinoHall", "childDinoSkull"], alt: "Музей динозавров" },
  space: { keys: ["rocketWarehouse", "rocketStatue", "shuttle", "spacecraft", "orangeRocket"], alt: "Космос и ракеты" },
  science: { keys: ["plasmaBall", "whaleMuseum", "dinoHall"], alt: "Научный музей" },
  museum: { keys: ["dinoHall", "whaleMuseum", "dinoSkylight", "plasmaBall", "childDinoSkull"], alt: "Музей" },
  play: { keys: ["balls", "slidesBallpit", "indoorPlay", "inflatableMall", "multicolorSlides", "playAreaSlide", "bounceHouse", "rubberDucks"], alt: "Игровая зона" },
  trampoline: { keys: ["trampolineIndoor", "obstacleFoam", "trampolines", "trampolineStations", "bungeeTrampoline"], alt: "Батутный парк" },
  climbing: { keys: ["climbingWall", "childClimbing", "kidsClimb", "childrenClimbing", "childrenClimbingTall"], alt: "Скалодром" },
  ropes: { keys: ["ropeBridge", "treehouseBridge", "ropesCourse", "forestBridge", "childrenClimbingTall", "kidsClimb"], alt: "Верёвочный парк" },
  waterpark: { keys: ["waterpark", "waterparkFamily", "waterparkSlides", "waterPlayground", "girlPool", "kidsPool"], alt: "Аквапарк" },
  ice: { keys: ["kidsSkating", "kidsHockey", "skatingPeople", "iceRink"], alt: "Каток" },
  art: { keys: ["girlPainting", "boyWatercolor", "paintPlates", "paintbrush"], alt: "Творческая студия" },
  theatre: { keys: ["frogPuppets", "marionette", "childrenReading"], alt: "Кукольный театр" },
  cafe: { keys: ["cafeChildWindow", "cafeMomChild", "cafeStroller", "cafeBearHat", "cafeWood", "cafePlants", "cafeWarm", "cafeBooks", "girlFruitBowl"], alt: "Уютное кафе" },
  pancakes: { keys: ["pancakeBlueberry", "pancakesBerries", "pancakes", "pancakesStrawberry"], alt: "Блины" },
  pizza: { keys: ["pizza", "pizzaLeaves", "pizzaTwo", "pizzaHand"], alt: "Пицца" },
  icecream: { keys: ["icecreamSprinkles", "icecreamThree", "icecreamCones", "icecreamPink", "icecreamHand", "icecreamStrawberry"], alt: "Мороженое" },
  toys: { keys: ["toyWindow", "toyShelves", "toyBoats", "plushPastries", "toyStorePeople", "toyCloseup", "teddyBow"], alt: "Магазин игрушек" },
  lego: { keys: ["lego", "legoMany", "legoStack", "legoAssorted"], alt: "Конструкторы" },
  books: { keys: ["kidsBooks", "childrenReading", "libraryMomChild", "boyReading"], alt: "Детские книги" },
  ferris: { keys: ["ferrisBlue", "carouselHorse", "ferrisWhite", "amusementNight", "ferrisRed"], alt: "Парк аттракционов" },
  greenhouse: { keys: ["greenhouse", "tropicalWaterfall", "greenhouseGlass", "bananaTrees"], alt: "Оранжерея" },
  rain: { keys: ["toddlerRainboots", "redBoots", "girlUmbrella", "childPinkRaincoat", "childYellowRaincoat", "childPuddle"], alt: "Дождливый день" },
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

type PhotoKey = keyof typeof PH;
type PhotoPick = { keys: PhotoKey[]; alt: string };

/**
 * Подборки для конкретных мест: кафе, музеи, театры и другие места, где общий набор по типу
 * дал бы одинаковые кадры. Первый кадр у каждого места свой.
 */
const KIDS_CAFE = "Детское кафе";
const FAMILY_CAFE = "Семейное кафе";
const MUSEUM = "Музей";
const pick = (alt: string, keys: PhotoKey[]): PhotoPick => ({ alt, keys });

export const PLACE_PHOTOS: Record<string, PhotoPick> = {
  // кафе и рестораны
  "depo-food-hall": pick("Фудхолл", ["foodHallPeople", "foodCourtNight", "foodTables", "pizzaTwo"]),
  "danilovsky-rynok": pick("Рынок и фудкорт", ["foodTables", "girlFruitBowl", "foodHallPeople", "pancakesBerries"]),
  "dream-kids": pick(KIDS_CAFE, ["indoorPlay", "girlPainting", "chefHatKid", "birthdayBalloons"]),
  "iyul-detyam": pick(KIDS_CAFE, ["playAreaSlide", "kidsCorner", "toddlerBalloons", "cafeMomChild"]),
  "russkoe-podvorye": pick(FAMILY_CAFE, ["girlPancakes1", "cafeWarm", "kidsCorner", "roundTable"]),
  "vasilchuki-chaihona-dmitriya-ulyanova": pick(FAMILY_CAFE, ["riceMeat", "restaurantLights", "balls", "cafeWood"]),
  "vasilchuki-chaihona-afimall": pick(FAMILY_CAFE, ["roundTable", "riceMeat", "rubberDucks", "cafePlants"]),
  "vasilchuki-chaihona-metropolis": pick(FAMILY_CAFE, ["restaurantLights", "cafeWarm", "multicolorSlides", "riceMeat"]),
  "piero-zilart": pick(FAMILY_CAFE, ["girlTable", "childMenu", "bounceHouse", "cafeWood"]),
  "ribambelle-vremena-goda": pick(KIDS_CAFE, ["multicolorSlides", "balls", "birthdayCake", "cafeStroller"]),
  "kitchen-khodynka": pick(FAMILY_CAFE, ["inflatableMall", "childDrawingCafe", "doughTable", "cafeWood"]),
  "anderson-ostrovityanova": pick(KIDS_CAFE, ["cafeChildWindow", "kidsCorner", "childMenu", "cafeBooks"]),
  "klich-zilart": pick(FAMILY_CAFE, ["slidesBallpit", "cafePlants", "candlesKids", "girlPancakes2"]),
  "repast-cafe": pick(FAMILY_CAFE, ["cafeMomChild", "roundTable", "rubberDucks", "pizzaHand"]),
  "local-kids-vnukovo": pick(KIDS_CAFE, ["bounceHouse", "kidsCorner", "cafeStroller", "girlTable"]),
  "littles-kids-play-cafe": pick(KIDS_CAFE, ["girlsTalking", "childDrawingCafe", "balls", "playAreaSlide", "cafeMomChild"]),
  "jooie-presnya": pick(KIDS_CAFE, ["birthdayBalloons", "indoorPlay", "cupcake", "girlPainting"]),
  "tutta-la-vita": pick("Итальянская кухня", ["pizzaLeaves", "pizza", "cafeWood", "childMenu"]),
  "kids-castle-mitino": pick(KIDS_CAFE, ["kidsCorner", "trampolines", "bounceHouse", "cafeChildWindow"]),
  // искусство и усадебные музеи
  "tretyakovka-lavrushinsky": pick("Картинная галерея", ["artKidStarry", "galleryPeople", "kidsDrawingsWall", "artKidBench"]),
  "pushkinsky-muzey": pick("Картинная галерея", ["artKidBench", "artKidStarry", "kidsDrawingsWall", "girlPainting"]),
  "dom-muzey-vasnecova": pick("Дом-музей художника", ["kidsDrawingsWall", "boyWatercolor", "paintbrush", "artKidBench"]),
  "ostankino-usadba": pick("Музей-усадьба", ["museumHallward", "statuesSkylight", "galleryPeople", "parkSun"]),
  // музеи по теме
  "kolomna-pastila-muzey": pick("Музей пастилы", ["cupcake", "pancakesBerries", "museumHallward", "cafeWarm"]),
  "muzey-novy-ierusalim": pick(MUSEUM, ["statuesSkylight", "museumPeople", "bigClock", "museumHallward"]),
  "muzey-tekhniki-zadorozhnogo": pick("Музей техники", ["armoredVehicle", "fighterJet", "bigClock", "museumPeople"]),
  "muzey-materinstva-ilinskoe": pick(MUSEUM, ["libraryMomChild", "toyShelves", "teddyPink", "kidsBooks"]),
  "muzey-nazad-v-sssr-zvenigorod": pick(MUSEUM, ["toyCloseup", "museumHallward", "bigClock", "kidsBooks"]),
  "dom-muzey-prishvina-dunino": pick("Дом-музей писателя", ["childrenReading", "autumnPath", "boyReading", "parkBench"]),
  "muzey-lozhki-solnechnogorsk": pick(MUSEUM, ["paintPlates", "museumHallward", "toyShelves", "museumPeople"]),
  "dolgoprudnensky-muzey": pick(MUSEUM, ["galleryPeople", "museumHallward", "bigClock"]),
  "muzey-moskvy": pick(MUSEUM, ["museumPeople", "bigClock", "museumHallward", "galleryPeople"]),
  "muzey-pobedy": pick("Музей Победы", ["memorialFlags", "armoredVehicle", "fighterJet", "wwiDiorama"]),
  "zoomuzey-msu": pick("Зоологический музей", ["crocodileSkeleton", "skeletonAnimal", "whaleMuseum", "museumPeople"]),
  gim: pick("Исторический музей", ["bigClock", "statuesSkylight", "museumHallward", "museumPeople"]),
  "borodinskaya-panorama": pick("Музей-панорама", ["wwiDiorama", "memorialFlags", "armoredVehicle", "museumHallward"]),
  "muzey-zhd-tehniki": pick("Музей железных дорог", ["trainSteam1", "trainSteam2", "bigClock", "museumPeople"]),
  "izmailovsky-kreml": pick("Сказочные терема и сувениры", ["woodenHouse", "toyShelves", "churchArch", "toyCloseup"]),
  "muzey-igrushki-sergiev-posad": pick("Музей игрушки", ["toyShelves", "toyBoats", "teddyBow", "toyCloseup"]),
  "kolomna-muzey-lyubimoy-igrushki": pick("Музей игрушки", ["teddyPink", "toyCloseup", "plushBasket", "teddies"]),
  // театры, цирки, кино
  "teatr-nash-dom-khimki": pick("Театр", ["theaterAudience", "theaterInterior", "frogPuppets", "childrenReading"]),
  "teatr-obrazcova": pick("Кукольный театр", ["frogPuppets", "marionette", "theaterInterior", "theaterAudience"]),
  "cirk-nikulina": pick("Цирк", ["circusTent", "acrobat", "circusNight", "theaterInterior"]),
  "bolshoy-moscow-cirk": pick("Цирк", ["circusNight", "circusTent", "acrobat", "theaterOrnate"]),
  "teatr-sats": pick("Театр", ["theaterOrnate", "theaterEmpty", "theaterInterior", "theaterAudience"]),
  "mosfilm-excursion": pick("Киностудия", ["filmCrew", "filmCamera", "clapper"]),
  "politehnichesky-muzey": pick("Музей науки и техники", ["rocketWarehouse", "spacecraft", "plasmaBall", "bigClock"]),
  // смотровые площадки
  "ostankino-tower": pick("Вид на город", ["citySkyline", "telescopeCity", "coinTelescope"]),
  "panorama360-federation": pick("Вид на город", ["telescopeCity", "citySkyline", "coinTelescope"]),
  // животные
  "huskyland-nazarevo": pick("Хаски", ["huskyBlueEyes", "huskyPuppy", "huskyDeck", "huskyAdult"]),
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Фото места: своя подборка, если она есть, иначе набор по типу.
 * `idx` — порядковый номер места внутри набора, `avoid` — первые кадры, которые уже заняты другими местами:
 * первый кадр берём из свободных, чтобы карточки в списках различались.
 */
export function photosFor(setKey: string, slug: string, _title?: string, idx?: number, avoid?: ReadonlySet<string>): Photo[] {
  const own = PLACE_PHOTOS[slug];
  const set: PhotoPick = own ?? PHOTO_SETS[setKey] ?? PHOTO_SETS.park;
  const len = set.keys.length;
  let step = 1;
  if (idx != null && len > 2) {
    step = Math.max(2, Math.floor(len / 3));
    while (gcd(step, len) !== 1) step++;
  }
  let start = own ? 0 : idx == null ? hash(slug) % len : (idx * step) % len;
  if (avoid) {
    for (let t = 0; t < len; t++) {
      const s = (start + t) % len;
      if (!avoid.has(PH[set.keys[s]])) {
        start = s;
        break;
      }
    }
  }
  const n = Math.min(4, len);
  return Array.from({ length: n }, (_, i) => ph(PH[set.keys[(start + i) % len]], set.alt));
}
