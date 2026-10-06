"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { decodeSnapshot } from "@/lib/social/share";
import { useAllCollections } from "@/lib/social/repo";
import { useSocial } from "@/lib/social/store";
import { CollectionScreen, Gone } from "./CollectionScreen";

function Inner() {
  const sp = useSearchParams();
  const d = sp.get("d");
  const id = sp.get("id");
  const all = useAllCollections();
  const hydrated = useSocial((s) => s.hydrated);
  const saved = useSocial((s) => s.saved);
  const snap = useMemo(() => (d ? decodeSnapshot(d) : null), [d]);

  if (id) {
    const local = all.find((r) => r.collection.id === id) ?? saved.find((x) => x.id === id)?.snapshot;
    if (local) return <CollectionScreen resolved={local} />;
    return hydrated ? <Gone kind="missing" /> : null;
  }
  if (!d || !snap) return <Gone kind={d ? "broken" : "missing"} />;
  // та же подборка могла быть в каталоге или у нас самих — тогда показываем актуальную версию
  const live = all.find((r) => r.collection.id === snap.collection.id);
  return <CollectionScreen resolved={live && live.source !== "snapshot" ? live : snap} />;
}

export function SharedCollectionPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
