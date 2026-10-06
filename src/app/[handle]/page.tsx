import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorScreen } from "@/components/social/CreatorScreen";
import { SEED_CREATORS } from "@/lib/social/seed";
import { seedCollectionsOf, seedCreatorByHandle, coverOf, placesOf } from "@/lib/social/catalog";

/** Публичная страница автора: /@username. Страницы демо-авторов предгенерированы (статический экспорт). */
export const dynamicParams = false;

export function generateStaticParams() {
  return SEED_CREATORS.filter((c) => c.status === "APPROVED").map((c) => ({ handle: `@${c.username}` }));
}

const resolve = (handle: string) => {
  let h = handle;
  try {
    h = decodeURIComponent(handle);
  } catch {
    /* как есть */
  }
  return h.startsWith("@") ? seedCreatorByHandle(h) : undefined;
};

export async function generateMetadata({ params }: PageProps<"/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const creator = resolve(handle);
  if (!creator) return {};
  const first = seedCollectionsOf(creator)[0];
  const art = first && coverOf(first.collection, placesOf(first.collection).placed);
  const photo = art ? (art.kind === "photo" ? art.tile.photo : art.tiles[0].photo) : undefined;
  const title = `${creator.display_name} — подборки мест для детей`;
  const description = `${creator.bio.slice(0, 140)}`;
  return {
    title,
    description,
    alternates: { canonical: `/@${creator.username}/` },
    openGraph: {
      title: `${creator.display_name} · КидГоу`,
      description: `Автор подборок · @${creator.username}`,
      type: "profile",
      ...(photo?.src ? { images: [{ url: `${photo.src}?w=1200&h=630&fit=crop&q=75`, width: 1200, height: 630, alt: photo.alt }] } : {}),
    },
  };
}

export default async function CreatorPage({ params }: PageProps<"/[handle]">) {
  const { handle } = await params;
  const creator = resolve(handle);
  if (!creator) notFound();
  return <CreatorScreen creator={creator} />;
}
