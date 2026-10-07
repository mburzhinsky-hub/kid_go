import { AppHeader } from "@/components/layout/AppHeader";
import { SearchBar } from "@/components/home/SearchBar";
import { CategoryScroller } from "@/components/home/CategoryScroller";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { HomeAdventureCards } from "@/components/cards/AreaAdventureCards";
import { adventureCardData } from "@/lib/cards";
import { PlaceCarousel } from "@/components/cards/PlaceCard";
import { EventCard } from "@/components/cards/EventCard";
import { HomeScenarios, HomeWeather, NearbyPopular, NearbyPopularHeader } from "@/components/home/HomeLive";
import { HomeCta } from "@/components/home/HomeCta";
import { TripFeedback } from "@/components/home/TripFeedback";
import { ForYou } from "@/components/home/ForYou";
import { OnboardingNudge } from "@/components/home/OnboardingNudge";
import { ParentsPicks } from "@/components/home/ParentsPicks";
import { SourceScope } from "@/components/social/SourceScope";
import { repo } from "@/lib/data/repository";

// Погода и афиша меняются в течение дня — обновляем страницу раз в 30 минут (ISR).
export const revalidate = 1800;

export default async function HomePage() {
  const [places, adventures, events] = await Promise.all([repo.listPlaces(), repo.listAdventures(), repo.listEvents()]);
  const adv = [...adventures].sort((a, b) => (b.recommend_percent ?? 0) - (a.recommend_percent ?? 0));

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  const placeMap = new Map(places.map((p) => [p.id, p]));
  const upcoming = events.filter((e) => e.end_at.slice(0, 10) >= today).sort((a, b) => a.start_at.localeCompare(b.start_at));

  const cafes = places.filter((p) => p.category === "cafe").slice(0, 6);

  return (
    <SourceScope source="HOME">
      <main className="pb-28">
        <h1 className="sr-only">Kids Go — куда пойти с детьми сегодня</h1>
        <AppHeader />
        <HomeCta />

        <section className="mt-7">
          <SectionHeader title="Или начните с ситуации" />
          <div className="mt-3.5">
            <HomeScenarios />
          </div>
        </section>

        <TripFeedback />

        <section className="mt-7">
          <SectionHeader title="Готовые приключения" href="/adventures" />
          <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-4 pt-1">
            <HomeAdventureCards items={adv.map(adventureCardData)} limit={6} />
          </div>
        </section>

        <section className="mt-8" aria-label="Поиск и карта">
          <p className="px-4 text-[14px] font-semibold text-muted">Знаете, куда хотите?</p>
          <div className="mt-2">
            <SearchBar placeholder="Найти место" />
          </div>
          <div className="mt-3">
            <CategoryScroller />
          </div>
        </section>

        <ParentsPicks />

        <div className="mt-3">
          <HomeWeather />
        </div>

        <section className="mt-7">
          <NearbyPopularHeader />
          <div className="mt-3">
            <NearbyPopular places={places} />
          </div>
        </section>

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
    </SourceScope>
  );
}
