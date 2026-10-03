import { AppHeader } from "@/components/layout/AppHeader";
import { SearchBar } from "@/components/home/SearchBar";
import { CategoryScroller } from "@/components/home/CategoryScroller";
import { type HeroSlide } from "@/components/home/HeroBanner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AdventureCard } from "@/components/cards/AdventureCard";
import { adventureCardData } from "@/lib/cards";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { EventCard } from "@/components/cards/EventCard";
import { HomeHero, HomeScenarios, HomeWeather, NearbyPopular } from "@/components/home/HomeLive";
import { TripFeedback } from "@/components/home/TripFeedback";
import { PlannerPromo } from "@/components/home/PlannerPromo";
import { ForYou } from "@/components/home/ForYou";
import { OnboardingNudge } from "@/components/home/OnboardingNudge";
import { repo } from "@/lib/data/repository";
import { PH, ph } from "@/lib/data/photos";

// Погода и афиша меняются в течение дня — обновляем страницу раз в 30 минут (ISR).
export const revalidate = 1800;

const SLIDES: HeroSlide[] = [
  {
    id: "weekend",
    title: "Выходные будут ярче!",
    subtitle: "Лучшие идеи для детей рядом с вами",
    cta: "Смотреть идеи",
    href: "/adventures",
    photo: ph(PH.childLaughing, "Смеющийся ребёнок"),
    tint: "#FFC8A8",
    emoji: "🎈",
    overlay: "linear-gradient(95deg, rgba(150,30,70,0.62) 0%, rgba(150,30,70,0.25) 48%, rgba(0,0,0,0) 72%)",
    doodle: "crown",
  },
  {
    id: "rain",
    title: "Дождь? Не беда!",
    subtitle: "Музеи, батуты и океанариум — всё под крышей",
    cta: "Идеи под крышей",
    href: "/planner/results?mood=surprise&duration=mid&weather=rain&from=rain",
    photo: ph(PH.childYellowRaincoat, "Ребёнок в жёлтом дождевике"),
    tint: "#BFD9FF",
    emoji: "☔",
    overlay: "linear-gradient(95deg, rgba(20,60,160,0.62) 0%, rgba(20,60,160,0.25) 50%, rgba(0,0,0,0) 74%)",
    doodle: "rain",
  },
  {
    id: "dino",
    title: "День динозавров",
    subtitle: "Готовый маршрут: музей → кафе → игрушки",
    cta: "Хочу так",
    href: "/adventures/den-dinozavrov",
    photo: ph(PH.dinoHall, "Скелет динозавра"),
    tint: "#E5D9FF",
    emoji: "🦖",
    overlay: "linear-gradient(95deg, rgba(70,30,140,0.66) 0%, rgba(70,30,140,0.25) 50%, rgba(0,0,0,0) 75%)",
    doodle: "dino",
  },
  {
    id: "free",
    title: "Весело и бесплатно",
    subtitle: "Парки и площадки, где не нужны билеты",
    cta: "Подобрать",
    href: "/planner/results?mood=outdoor&duration=mid&budget=free&weather=sun&from=free",
    photo: ph(PH.woodenPlayground, "Деревянная площадка"),
    tint: "#CFEFC4",
    emoji: "🌳",
    overlay: "linear-gradient(95deg, rgba(10,110,60,0.62) 0%, rgba(10,110,60,0.25) 50%, rgba(0,0,0,0) 75%)",
    doodle: "star",
  },
];

export default async function HomePage() {
  const [places, adventures, events] = await Promise.all([repo.listPlaces(), repo.listAdventures(), repo.listEvents()]);
  const adv = [...adventures].sort((a, b) => b.recommend_percent - a.recommend_percent);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const placeMap = new Map(places.map((p) => [p.id, p]));
  const upcoming = events.filter((e) => e.end_at.slice(0, 10) >= today).sort((a, b) => a.start_at.localeCompare(b.start_at));

  const cafes = places.filter((p) => p.category === "cafe").slice(0, 6);

  return (
    <main className="pb-28">
      <AppHeader />
      <SearchBar />
      <div className="mt-4">
        <CategoryScroller />
      </div>
      <div className="mt-4">
        <HomeHero slides={SLIDES} />
      </div>

      <section className="mt-7">
        <SectionHeader title="Что хочется сегодня?" />
        <div className="mt-3.5">
          <HomeScenarios />
        </div>
      </section>

      <TripFeedback />

      <section className="mt-7">
        <SectionHeader title="Готовые приключения" href="/adventures" />
        <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-4 pt-1">
          {adv.slice(0, 6).map((a, i) => (
            <AdventureCard key={a.id} data={adventureCardData(a)} priority={i === 0} />
          ))}
        </div>
      </section>

      <div className="mt-3">
        <HomeWeather />
      </div>

      <section className="mt-7">
        <SectionHeader title="Популярное рядом" href="/search?sort=popular" />
        <div className="mt-3">
          <NearbyPopular places={places} />
        </div>
      </section>

      <div className="mt-5">
        <PlannerPromo />
      </div>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Что происходит сегодня" subtitle="Шоу, мастер-классы и чтения" />
          <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} place={placeMap.get(e.place_id)!} isToday={e.start_at.slice(0, 10) === today} />
            ))}
          </div>
        </section>
      )}

      <ForYou />
      <OnboardingNudge />

      <section className="mt-7">
        <SectionHeader title="Поесть всей семьёй" subtitle="Детское меню и игровые уголки" href="/search?category=cafe" />
        <div className="mt-3">
          <PlaceCarousel places={cafes} />
        </div>
      </section>
    </main>
  );
}
