"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { decodeSnapshot } from "@/lib/social/share";
import { useAllCollections } from "@/lib/social/repo";
import { useSocial } from "@/lib/social/store";
import type { ResolvedCollection } from "@/lib/social/types";
import { ACCOUNTS_ENABLED, api, ApiError, type ApiAuthor } from "@/lib/account/api";
import { CollectionScreen, Gone } from "./CollectionScreen";

type Remote = { state: "idle" | "loading" | "missing" | "ok"; value?: ResolvedCollection };

function Inner() {
  const sp = useSearchParams();
  const d = sp.get("d");
  // короткий адрес /c/<код>/ отдаёт сервер с превью; код читаем из адресной строки уже после загрузки (страница статическая)
  const [pathId, setPathId] = useState<string | null>(null);
  useEffect(() => {
    const m = location.pathname.match(/\/c\/([a-z0-9]{10})\/?$/);
    setPathId(m ? m[1] : null);
  }, []);
  const id = sp.get("id") ?? pathId;
  const all = useAllCollections();
  const hydrated = useSocial((s) => s.hydrated);
  const saved = useSocial((s) => s.saved);
  const snap = useMemo(() => (d ? decodeSnapshot(d) : null), [d]);
  const local = id ? (all.find((r) => r.collection.id === id) ?? saved.find((x) => x.id === id)?.snapshot) : undefined;
  const [remote, setRemote] = useState<Remote>({ state: "idle" });

  // подборки по короткой ссылке читаем с сервера: друг открывает без кабинета
  useEffect(() => {
    if (!id || local || !hydrated || !ACCOUNTS_ENABLED || !/^[a-z0-9]{10}$/.test(id)) return;
    let cancelled = false;
    setRemote({ state: "loading" });
    api<{ collection: ResolvedCollection["collection"]; author: ApiAuthor }>("GET", `/collections/${id}`)
      .then((r) => !cancelled && setRemote({ state: "ok", value: { collection: r.collection, author: { ...r.author, hasPage: false }, source: "snapshot" } }))
      .catch((e) => !cancelled && setRemote({ state: e instanceof ApiError && e.status !== 404 ? "idle" : "missing" }));
    return () => {
      cancelled = true;
    };
  }, [id, local, hydrated]);

  if (id) {
    if (local) return <CollectionScreen resolved={local} />;
    if (remote.state === "ok" && remote.value) return <CollectionScreen resolved={remote.value} />;
    if (!hydrated || remote.state === "loading") return null;
    return <Gone kind="missing" />;
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
