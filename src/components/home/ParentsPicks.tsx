"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CollectionCard } from "@/components/social/CollectionCard";
import { usePublicCollections } from "@/lib/social/repo";
import { useSocial } from "@/lib/social/store";

/**
 * «Советуют родители» — публичные подборки. Стоит ниже главного предложения (сценарии и приключения), а не вместо него.
 * Пока подборки не загрузились или их нет — блок не занимает места.
 */
export function ParentsPicks() {
  const ready = useSocial((s) => s.hydrated);
  const list = usePublicCollections({ limit: 8 });
  if (!ready || !list.length) return null;
  return (
    <section className="mt-7">
      <SectionHeader title="Советуют родители" subtitle="Подборки мест от тех, кто там уже был" />
      <div className="no-scrollbar snap-x-pad mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-4 pt-1">
        {list.map((r, i) => (
          <CollectionCard key={r.collection.id} data={r} priority={i === 0} />
        ))}
        <Link href="/collections/new/?from=home" className="press flex w-[220px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[24px] bg-pink-50 px-5 py-6 text-center ring-1 ring-pink/15">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-pink text-white shadow-pink">
            <Plus size={24} strokeWidth={2.6} />
          </span>
          <span className="text-[17px] font-bold leading-tight">Есть любимые места?</span>
          <span className="text-[14px] leading-snug text-ink-2">Соберите свою подборку и отправьте друзьям</span>
        </Link>
      </div>
    </section>
  );
}
