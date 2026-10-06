"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CollectionBuilder } from "./CollectionBuilder";
import { authorOf, seedCreatorByHandle } from "@/lib/social/catalog";

function Inner() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? undefined;
  const as = sp.get("as");
  const asAuthor = useMemo(() => {
    const c = as ? seedCreatorByHandle(as) : undefined;
    return c ? authorOf(c) : undefined;
  }, [as]);
  return <CollectionBuilder key={id ?? as ?? "new"} editId={id} asAuthor={asAuthor} from={sp.get("from") ?? undefined} />;
}

export function BuilderRoute() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
