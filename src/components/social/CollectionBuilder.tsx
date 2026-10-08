"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X, Check, GripVertical, Trash2, MessageSquarePlus, Lock, Link2, Globe, Share2, PartyPopper, ArrowLeft } from "lucide-react";
import type { AuthorRef, Collection, CollectionCover as CoverChoice, Visibility, ResolvedCollection } from "@/lib/social/types";
import type { Place } from "@/lib/types";
import { allPlaces, getPlaceSync } from "@/lib/data/repository";
import { ACCOUNTS_ENABLED } from "@/lib/account/api";
import { createCollection, updateCollection, publishCollection, validateHandle, becomeCreator, myAuthor, MAX_ITEMS, MAX_NOTE, MAX_TITLE } from "@/lib/social/repo";
import { slugify } from "@/lib/social/catalog";
import { trackEvent } from "@/lib/social/events";
import { useSocial } from "@/lib/social/store";
import { useFamily } from "@/lib/store";
import { useOkrug } from "@/lib/use-okrug";
import { orderByArea } from "@/lib/area-fit";
import { useSocialUi } from "@/lib/social/ui-store";
import { collectionShareText, collectionUrl } from "@/lib/social/share";
import { placesOf, coverOf, placesWord } from "@/lib/social/catalog";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SmartImage } from "@/components/ui/SmartImage";
import { BackButton } from "@/components/ui/BackButton";
import { useToast } from "@/components/ui/Toast";
import { categoryDef } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { CreatorAvatar } from "./Avatar";
import type { ShareTarget } from "./ShareSheet";
import { CollectionScreen } from "./CollectionScreen";
import { CollectionCover } from "./CollectionCover";

const AGE_GROUPS = [
  { id: "a", label: "0–2", min: 0, max: 2 },
  { id: "b", label: "3–5", min: 3, max: 5 },
  { id: "c", label: "6–8", min: 6, max: 8 },
  { id: "d", label: "9–12", min: 9, max: 12 },
] as const;

const AVATARS = ["🧸", "🦊", "🐼", "🦁", "🐰", "🐸", "🦄", "🌈"];
const TINTS = ["#FFE4F1", "#EEE5FE", "#E2EEFF", "#E4F4DD", "#FFF3D6", "#FFE3D4"];

interface Item {
  place_id: string;
  creator_note?: string;
}

interface Form {
  title: string;
  description: string;
  items: Item[];
  cover: CoverChoice;
  visibility: Visibility;
  groups: string[];
}

const VIS: { id: Visibility; label: string; hint: string; Icon: typeof Globe }[] = [
  { id: "PUBLIC", label: "Публичная", hint: "Видна на странице автора и на главной, отправляйте ссылкой", Icon: Globe },
  { id: "UNLISTED", label: "По ссылке", hint: "Откроется у тех, кому вы отправили ссылку", Icon: Link2 },
  { id: "PRIVATE", label: "Приватная", hint: "Видите только вы — для себя или черновик", Icon: Lock },
];

const quality = (p: Place) => p.rating * 2 + Math.log10(p.review_count + 1) + (p.is_hit ? 1 : 0);
const pickable = (p: Place) => !p.slug.startsWith("osm-");

function groupsOf(places: Place[]): string[] {
  if (!places.length) return AGE_GROUPS.map((g) => g.id);
  const on = AGE_GROUPS.filter((g) => places.filter((p) => p.age_min <= g.max && p.age_max >= g.min).length >= Math.ceil(places.length / 2));
  return (on.length ? on : AGE_GROUPS).map((g) => g.id);
}

function rangeOf(ids: string[]): [number, number] {
  const gs = AGE_GROUPS.filter((g) => ids.includes(g.id));
  if (!gs.length) return [0, 12];
  return [Math.min(...gs.map((g) => g.min)), Math.max(...gs.map((g) => g.max))];
}

/**
 * Конструктор подборки: название → места (поиск, «хочу сходить», недавние, рядом) → порядок (перетаскивание) →
 * заметки автора → обложка → видимость → предпросмотр → публикация. Черновик сохраняется на каждом шаге.
 */
export function CollectionBuilder({ editId, asAuthor, from }: { editId?: string; asAuthor?: AuthorRef; from?: string }) {
  const toast = useToast((s) => s.show);
  const openShare = useSocialUi((s) => s.openShare);
  const hydrated = useSocial((s) => s.hydrated);
  const me = useSocial((s) => s.me);
  const existing = useSocial((s) => (editId ? s.collections.find((c) => c.id === editId) : undefined));
  const existingAuthor = useSocial((s) => (editId ? s.authors[editId] : undefined));
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ title: "", description: "", items: [], cover: { kind: "collage" }, visibility: "PUBLIC", groups: AGE_GROUPS.map((g) => g.id) });
  const [draftId, setDraftId] = useState<string | undefined>(editId);
  const [loaded, setLoaded] = useState(!editId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [done, setDone] = useState<ResolvedCollection | null>(null);
  const [groupsTouched, setGroupsTouched] = useState(false);
  const startedRef = useRef(false);

  const author: AuthorRef | undefined = asAuthor ?? existingAuthor ?? (me ? myAuthor(me) : undefined);

  /* загрузка существующей подборки */
  useEffect(() => {
    if (!editId || loaded || !hydrated) return;
    if (existing) {
      setForm({
        title: existing.title,
        description: existing.description,
        items: existing.items.map((i) => ({ place_id: i.place_id, creator_note: i.creator_note })),
        cover: existing.cover,
        visibility: existing.visibility,
        groups: AGE_GROUPS.filter((g) => existing.age_min <= g.max && existing.age_max >= g.min).map((g) => g.id),
      });
      setGroupsTouched(true);
    }
    setLoaded(true);
  }, [editId, existing, hydrated, loaded]);

  /* начало работы — событие роста (с привязкой к автору, который привёл) */
  useEffect(() => {
    if (editId || startedRef.current) return;
    startedRef.current = true;
    trackEvent("collection_create_started", { from: from ?? "direct" });
  }, [editId, from]);

  const places = useMemo(() => form.items.map((i) => getPlaceSync(i.place_id)).filter(Boolean) as Place[], [form.items]);

  // возраст подсказываем по местам, пока автор сам его не менял
  useEffect(() => {
    if (!groupsTouched && places.length) setForm((f) => ({ ...f, groups: groupsOf(places) }));
  }, [places, groupsTouched]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const canNext = step === 0 ? form.title.trim().length >= 3 : step === 1 ? form.items.length >= 1 : true;

  const persist = (): Collection | null => {
    const [age_min, age_max] = rangeOf(form.groups);
    const input = { title: form.title, description: form.description, items: form.items, cover: form.cover, visibility: form.visibility, age_min, age_max };
    if (draftId) return updateCollection(draftId, input);
    const c = createCollection({ ...input, as: asAuthor });
    setDraftId(c.id);
    return c;
  };

  const next = () => {
    if (!canNext) return;
    persist();
    if (step < 2) setStep(step + 1);
    else setPreview(true);
  };

  const finish = (who: AuthorRef | undefined = author) => {
    if (!who) {
      setProfileOpen(true);
      return;
    }
    const c = persist();
    if (!c) return;
    const pub = publishCollection(c.id, form.visibility);
    if (!pub) return;
    const r: ResolvedCollection = { collection: pub, author: who, source: "local" };
    setDone(r);
    setPreview(false);
  };

  const previewResolved: ResolvedCollection = useMemo(() => {
    const [age_min, age_max] = rangeOf(form.groups);
    const id = draftId ?? "preview";
    const col: Collection = {
      id,
      user_id: author?.id ?? "u-preview",
      title: form.title.trim() || "Без названия",
      slug: slugify(form.title),
      description: form.description,
      cover: form.cover,
      city: useFamily.getState().city || "Москва",
      visibility: form.visibility,
      status: "PUBLISHED",
      age_min,
      age_max,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: form.items.map((i, position) => ({ id: `${id}-${position}`, collection_id: id, place_id: i.place_id, position, creator_note: i.creator_note })),
    };
    return { collection: col, author: author ?? { id: "u-preview", name: "Вы", username: "", avatar: "🧸", tint: "#FFE4F1" }, source: "local" };
  }, [form, draftId, author]);

  if (!loaded || (editId && !hydrated)) return <main className="grid min-h-dvh place-items-center text-muted">Загружаем…</main>;
  if (editId && !existing && hydrated) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-[20px] font-bold">Подборка не найдена</p>
          <p className="mt-1 text-[15px] text-muted">Возможно, её удалили на этом устройстве.</p>
          <Link href="/collections/" className="press mt-4 inline-flex h-12 items-center rounded-full bg-pink px-6 font-semibold text-white shadow-pink">
            Мои подборки
          </Link>
        </div>
      </main>
    );
  }

  if (done) return <Success r={done} onShare={() => shareDone(done, openShare)} />;

  const TITLES = ["Название", "Места", "Обложка и доступ"];
  return (
    <main className="flex h-dvh flex-col px-4 pt-[max(14px,env(safe-area-inset-top))]">
      <div className="flex shrink-0 items-center gap-3">
        <BackButton fallback="/collections/" onClick={step > 0 ? () => setStep(step - 1) : undefined} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-muted">Шаг {step + 1} из 3</p>
          <h1 className="tight truncate text-[22px] font-[850] leading-tight">{editId ? "Редактирование · " : ""}{TITLES[step]}</h1>
        </div>
        {asAuthor && <CreatorAvatar author={asAuthor} size={36} />}
      </div>

      <div className="no-scrollbar -mx-4 mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {step === 0 && (
          <section className="animate-rise pt-3">
            <label className="block">
              <span className="text-[14px] font-semibold text-ink-2">Как назовём подборку?</span>
              <input
                value={form.title}
                maxLength={MAX_TITLE}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Например: 10 мест на дождь"
                autoFocus
                className="mt-2 h-12 w-full rounded-[20px] bg-surface px-4 text-[17px] font-semibold shadow-card outline-none focus:ring-2 focus:ring-pink/40"
              />
              <span className="mt-1 block text-right text-[12px] text-muted">{form.title.length}/{MAX_TITLE}</span>
            </label>
            <label className="mt-3 block">
              <span className="text-[14px] font-semibold text-ink-2">Пара слов о подборке <span className="font-normal text-muted">— по желанию</span></span>
              <textarea
                value={form.description}
                maxLength={600}
                rows={4}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Для кого она и чем хороша: «всё под крышей, везде есть гардероб»"
                className="mt-2 w-full resize-none rounded-[20px] bg-surface px-4 py-3 text-[16px] leading-snug shadow-card outline-none focus:ring-2 focus:ring-pink/40"
              />
            </label>
            <p className="mt-4 rounded-[16px] bg-blue-50 px-3.5 py-3 text-[14px] leading-snug text-ink-2">💡 Хорошая подборка — это 5–10 мест и короткие заметки о том, что важно знать родителю.</p>
          </section>
        )}

        {step === 1 && (
          <section className="animate-rise pt-3">
            {form.items.length === 0 ? (
              <button onClick={() => setPickerOpen(true)} className="press flex h-36 w-full flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-[#dcd9d2] text-muted">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-pink text-white shadow-pink">
                  <Plus size={24} />
                </span>
                <span className="text-[16px] font-semibold text-ink">Добавить места</span>
                <span className="text-[13px]">Поиск, «Хочу сходить», недавние, рядом</span>
              </button>
            ) : (
              <>
                <p className="mb-2 text-[14px] text-muted">Перетаскивайте за ручку ⠿, чтобы поменять порядок. К каждому месту можно добавить заметку.</p>
                <ReorderList items={form.items} onChange={(items) => patch({ items })} />
                {form.items.length < MAX_ITEMS ? (
                  <button onClick={() => setPickerOpen(true)} className="press mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-[#dcd9d2] text-[16px] font-semibold text-pink-ink">
                    <Plus size={20} /> Добавить ещё место
                  </button>
                ) : (
                  <p className="mt-3 text-center text-[13px] text-muted">Максимум {MAX_ITEMS} мест</p>
                )}
              </>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="animate-rise pt-3">
            <h2 className="text-[15px] font-bold">Обложка</h2>
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2.5 overflow-x-auto px-4 pb-1">
              <CoverTile active={form.cover.kind === "collage"} onClick={() => patch({ cover: { kind: "collage" } })} label="Коллаж">
                <CollectionCover art={coverOf({ ...previewResolved.collection, cover: { kind: "collage" } }, places.map((place, i) => ({ place, item: { id: String(i), collection_id: "", place_id: place.slug, position: i } })))} sizes="96px" className="h-full w-full" />
              </CoverTile>
              {places.slice(0, 12).map((p) => (
                <CoverTile key={p.slug} active={form.cover.kind === "place" && form.cover.slug === p.slug} onClick={() => patch({ cover: { kind: "place", slug: p.slug } })} label={p.title}>
                  <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="96px" className="h-full w-full" />
                </CoverTile>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-muted">Обложка — из фото мест в подборке.</p>

            <h2 className="mt-6 text-[15px] font-bold">Для каких детей</h2>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Возраст">
              {AGE_GROUPS.map((g) => {
                const on = form.groups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    aria-pressed={on}
                    onClick={() => {
                      setGroupsTouched(true);
                      patch({ groups: on ? (form.groups.length > 1 ? form.groups.filter((x) => x !== g.id) : form.groups) : [...form.groups, g.id] });
                    }}
                    className={cn("press h-11 rounded-full px-5 text-[16px] font-semibold", on ? "bg-ink text-white" : "bg-surface text-ink shadow-card")}
                  >
                    {g.label} лет
                  </button>
                );
              })}
            </div>

            <h2 className="mt-6 text-[15px] font-bold">Кто увидит</h2>
            <div className="mt-2 space-y-2" role="radiogroup" aria-label="Видимость">
              {VIS.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={form.visibility === id}
                  onClick={() => patch({ visibility: id })}
                  className={cn("press flex w-full items-center gap-3 rounded-[20px] p-3 text-left", form.visibility === id ? "bg-pink-50 ring-2 ring-inset ring-pink/50" : "bg-surface shadow-card")}
                >
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", form.visibility === id ? "bg-white text-pink-ink" : "bg-fill text-ink-2")}>
                    <Icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold leading-tight">{label}</span>
                    <span className="block text-[13px] leading-snug text-muted">{hint}</span>
                  </span>
                  {form.visibility === id && <Check size={20} className="text-pink-ink" />}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="relative flex shrink-0 items-center gap-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-5 h-5 bg-gradient-to-t from-bg to-transparent" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-pink" : "w-2 bg-[#e3e0da]")} />
          ))}
        </div>
        <button
          onClick={next}
          disabled={!canNext}
          className="press ml-auto h-14 flex-1 rounded-full bg-pink text-[17px] font-bold text-white shadow-pink disabled:opacity-40 disabled:shadow-none"
        >
          {step === 0 ? "Дальше — места" : step === 1 ? `Дальше · ${placesWord(form.items.length)}` : "Предпросмотр"}
        </button>
      </div>

      <PlacePicker open={pickerOpen} onClose={() => setPickerOpen(false)} selected={form.items.map((i) => i.place_id)} onToggle={(slug) => patch({ items: form.items.some((i) => i.place_id === slug) ? form.items.filter((i) => i.place_id !== slug) : form.items.length >= MAX_ITEMS ? form.items : [...form.items, { place_id: slug }] })} />

      {preview && (
        <div className="fixed inset-0 z-[60] mx-auto max-w-[480px] overflow-y-auto bg-bg">
          <div className="sticky top-0 z-10 bg-yellow-50 px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-center text-[13px] font-semibold text-yellow-ink">Так подборку увидят другие</div>
          <CollectionScreen resolved={previewResolved} preview />
          <div className="sticky bottom-0 z-10 flex gap-2.5 bg-gradient-to-t from-bg from-70% to-transparent px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-6">
            <button onClick={() => setPreview(false)} className="press inline-flex h-14 items-center gap-1.5 rounded-full bg-surface px-5 text-[16px] font-bold shadow-card">
              <ArrowLeft size={20} /> Править
            </button>
            <button onClick={() => finish()} className="press h-14 flex-1 rounded-full bg-pink text-[17px] font-bold text-white shadow-pink">
              {editId ? "Сохранить" : "Опубликовать"}
            </button>
          </div>
        </div>
      )}

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onAccount={ACCOUNTS_ENABLED ? () => {
          setProfileOpen(false);
          // после входа или создания кабинета подпись берётся из него, публикуем сразу
          useSocialUi.getState().openAccount("register", () => {
            const m = useSocial.getState().me;
            if (m) finish(myAuthor(m));
          });
        } : undefined}
        onSave={(p) => {
          const profile = becomeCreator(p);
          setProfileOpen(false);
          toast("Готово — теперь вы автор подборок ✨");
          finish(myAuthor(profile)); // профиль создан — публикуем сразу
        }}
      />
    </main>
  );
}

function shareDone(r: ResolvedCollection, openShare: (t: ShareTarget) => void) {
  const { placed } = placesOf(r.collection);
  const art = coverOf(r.collection, placed);
  openShare({
    kind: "collection",
    heading: "Поделиться подборкой",
    text: collectionShareText(r),
    buildUrl: (utm) => collectionUrl(r, utm),
    preview: { tile: art.kind === "photo" ? art.tile : art.tiles[0], title: r.collection.title, subtitle: `Подборка ${r.author.name} · ${placesWord(placed.length)}` },
    ids: { creator_id: r.author.id, collection_id: r.collection.id },
  });
}

function Success({ r, onShare }: { r: ResolvedCollection; onShare: () => void }) {
  const priv = r.collection.visibility === "PRIVATE";
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-10 text-center">
      <div className="relative grid h-[132px] w-[160px] place-items-center">
        <div className="absolute inset-x-3 bottom-0 top-3 rounded-[48%_52%_46%_54%/55%_48%_52%_45%] bg-pink-50" />
        <PartyPopper size={72} className="relative text-pink-ink animate-bob" strokeWidth={2} />
      </div>
      <h1 className="tight mt-4 text-[30px] font-[850] leading-tight">{priv ? "Подборка сохранена" : "Подборка опубликована 🎉"}</h1>
      <p className="mt-2 max-w-[320px] text-[16px] leading-snug text-muted">{priv ? "Её видите только вы. Откройте доступ в редакторе, когда захотите поделиться." : "Отправьте ссылку друзьям — они откроют подборку без регистрации."}</p>
      <div className="mt-6 w-full max-w-[360px] space-y-2.5">
        {!priv && (
          <button onClick={onShare} className="press flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink">
            <Share2 size={20} /> Поделиться
          </button>
        )}
        <Link href={`/c/?id=${encodeURIComponent(r.collection.id)}`} className="press flex h-14 w-full items-center justify-center rounded-full bg-surface text-[17px] font-bold shadow-card">
          Посмотреть подборку
        </Link>
        <Link href="/collections/" className="press flex h-12 w-full items-center justify-center text-[16px] font-semibold text-blue-ink">
          Мои подборки
        </Link>
      </div>
    </main>
  );
}

function CoverTile({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={`Обложка: ${label}`} className={cn("press relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[20px]", active ? "ring-[3px] ring-pink ring-offset-2 ring-offset-bg" : "ring-1 ring-line")}>
      {children}
      {active && (
        <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-pink text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/* ───────── перетаскиваемый список ───────── */

function ReorderList({ items, onChange }: { items: Item[]; onChange: (items: Item[]) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null);
  const geo = useRef<{ top: number[]; h: number[]; y0: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set());

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  const start = (e: React.PointerEvent, index: number) => {
    const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    const rects = rows.map((r) => r.getBoundingClientRect());
    geo.current = { top: rects.map((r) => r.top), h: rects.map((r) => r.height), y0: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: index, to: index, dy: 0, h: rects[index]?.height ?? 0 });
  };

  const moveTo = (e: React.PointerEvent) => {
    if (!drag || !geo.current) return;
    const { top, h, y0 } = geo.current;
    const dy = e.clientY - y0;
    const center = top[drag.from] + h[drag.from] / 2 + dy;
    let to = drag.from;
    for (let i = 0; i < top.length; i++) if (center >= top[i] && center <= top[i] + h[i]) to = i;
    if (center < top[0]) to = 0;
    if (center > top[top.length - 1] + h[top.length - 1]) to = top.length - 1;
    setDrag({ ...drag, to, dy });
  };

  const end = () => {
    if (drag) move(drag.from, drag.to);
    setDrag(null);
    geo.current = null;
  };

  const shiftOf = (i: number) => {
    if (!drag || i === drag.from) return 0;
    const gap = 10;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -(drag.h + gap);
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return drag.h + gap;
    return 0;
  };

  return (
    <ul ref={listRef} className="space-y-2.5">
      {items.map((it, i) => {
        const p = getPlaceSync(it.place_id);
        const cat = p ? categoryDef(p.category) : undefined;
        const dragging = drag?.from === i;
        const hasNote = !!it.creator_note || noteOpen.has(it.place_id);
        return (
          <li
            key={it.place_id}
            style={{ transform: dragging ? `translateY(${drag!.dy}px) scale(1.02)` : `translateY(${shiftOf(i)}px)`, transition: dragging ? "none" : "transform .18s ease", zIndex: dragging ? 5 : 0 }}
            className={cn("relative rounded-[20px] bg-surface p-2.5 shadow-card", dragging && "shadow-float ring-2 ring-pink/40")}
          >
            <div className="flex items-center gap-2.5">
              <button
                aria-label={`Перетащить: ${p?.title ?? it.place_id}. Стрелки вверх и вниз меняют порядок`}
                onPointerDown={(e) => start(e, i)}
                onPointerMove={moveTo}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const to = i + (e.key === "ArrowUp" ? -1 : 1);
                    move(i, to);
                    requestAnimationFrame(() => document.getElementById(`h-${it.place_id}`)?.focus());
                  }
                }}
                id={`h-${it.place_id}`}
                data-drag-handle
                className="grid h-12 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted-2 active:cursor-grabbing"
              >
                <GripVertical size={24} />
              </button>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-bold">{i + 1}</span>
              {p && <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="56px" className="h-14 w-14 shrink-0 rounded-[12px]" />}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[16px] font-semibold leading-tight">{p?.title ?? "Место недоступно"}</p>
                {cat && (
                  <p className="mt-0.5 truncate text-[13px] font-medium" style={{ color: cat.ink }}>
                    {cat.name}
                  </p>
                )}
              </div>
              <button aria-label={`Убрать: ${p?.title ?? it.place_id}`} onClick={() => onChange(items.filter((x) => x.place_id !== it.place_id))} className="press hit relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill text-muted">
                <Trash2 size={16} />
              </button>
            </div>
            {hasNote ? (
              <div className="mt-2">
                <textarea
                  value={it.creator_note ?? ""}
                  maxLength={MAX_NOTE}
                  rows={2}
                  onChange={(e) => onChange(items.map((x) => (x.place_id === it.place_id ? { ...x, creator_note: e.target.value } : x)))}
                  placeholder="Комментарий автора: что важно знать, во сколько приехать, что взять"
                  aria-label={`Заметка к месту ${p?.title ?? ""}`}
                  className="w-full resize-none rounded-[12px] bg-fill-2 px-3 py-2.5 text-[15px] leading-snug outline-none ring-1 ring-line focus:ring-2 focus:ring-pink/40"
                />
                <p className="text-right text-[12px] text-muted">{(it.creator_note ?? "").length}/{MAX_NOTE}</p>
              </div>
            ) : (
              <button onClick={() => setNoteOpen((s) => new Set(s).add(it.place_id))} className="press hit relative ml-1 mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-[14px] font-semibold text-blue-ink">
                <MessageSquarePlus size={16} /> Заметка
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────── выбор мест ───────── */

type PickTab = "all" | "want" | "recent" | "near";

function PlacePicker({ open, onClose, selected, onToggle }: { open: boolean; onClose: () => void; selected: string[]; onToggle: (slug: string) => void }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<PickTab>("all");
  const want = useFamily((s) => s.wantPlaces);
  const recent = useSocial((s) => s.recent);
  const okrug = useOkrug();
  const pool = useMemo(() => allPlaces.filter(pickable), []);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    let base: Place[];
    if (text) base = pool.filter((p) => `${p.title} ${p.subtitle} ${p.address} ${p.metro ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(text));
    else if (tab === "want") base = want.map((s) => getPlaceSync(s)).filter((p): p is Place => !!p && pickable(p));
    else if (tab === "recent") base = recent.map((s) => getPlaceSync(s)).filter((p): p is Place => !!p && pickable(p));
    else if (tab === "near") base = okrug ? orderByArea(pool, (p) => p, okrug, quality, { enough: 6 }).list.slice(0, 40) : [...pool].filter((p) => p.region !== "mo").sort((a, b) => quality(b) - quality(a)).slice(0, 40);
    else base = [...pool].sort((a, b) => quality(b) - quality(a));
    return base;
  }, [q, tab, pool, want, recent, okrug]);

  const TABS: { id: PickTab; label: string }[] = [
    { id: "all", label: "Все места" },
    { id: "want", label: `Хочу сходить${want.length ? ` · ${want.length}` : ""}` },
    { id: "recent", label: "Недавние" },
    { id: "near", label: okrug ? `Популярные ${okrug.prep}` : "Популярные" },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} title="Добавить места" className="min-h-[70dvh]">
      <label className="flex h-12 items-center gap-2.5 rounded-full bg-fill px-4">
        <Search size={20} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, метро или тема" aria-label="Поиск мест" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        {q && (
          <button onClick={() => setQ("")} aria-label="Очистить">
            <X size={16} className="text-muted" />
          </button>
        )}
      </label>
      {!q && (
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className={cn("press hit relative h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[14px] font-semibold", tab === t.id ? "bg-ink text-white" : "bg-fill")}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-3 space-y-1.5 pb-24">
        {list.length === 0 && <li className="py-8 text-center text-[15px] text-muted">{q ? "Ничего не нашлось — попробуйте другое слово" : tab === "want" ? "Пока нет хотелок — нажимайте «Хочу сюда» на местах" : "Здесь пока пусто"}</li>}
        {list.slice(0, 80).map((p) => {
          const on = selected.includes(p.slug);
          return (
            <li key={p.slug}>
              <button onClick={() => onToggle(p.slug)} aria-pressed={on} className={cn("press flex w-full items-center gap-3 rounded-[20px] p-2 text-left", on ? "bg-pink-50" : "bg-fill-2")}>
                <SmartImage photo={p.photos[0]} tint={p.tint} emoji={p.emoji} sizes="52px" className="h-[52px] w-[52px] shrink-0 rounded-[12px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold leading-tight">{p.title}</span>
                  <span className="block truncate text-[13px] text-muted">{categoryDef(p.category).name} · {p.subtitle}</span>
                </span>
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-pink text-white" : "bg-white text-pink-ink shadow-card")}>{on ? <Check size={20} strokeWidth={3} /> : <Plus size={20} />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-surface from-70% to-transparent px-5 pb-1 pt-4">
        <button onClick={onClose} className="press h-14 w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink">
          Готово{selected.length ? ` · ${placesWord(selected.length)}` : ""}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ───────── подпись автора (при первой публикации) ───────── */

function ProfileSheet({ open, onClose, onSave, onAccount }: { open: boolean; onClose: () => void; onAccount?: () => void; onSave: (p: { name: string; username: string; avatar: string; tint: string }) => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [tint, setTint] = useState(TINTS[0]);
  const handle = touched ? username : slugify(name, 24);
  const err = name.trim().length >= 2 ? validateHandle(handle) : "Введите имя";
  return (
    <BottomSheet open={open} onClose={onClose} title="Как вас подписать?">
      <p className="-mt-1 text-[15px] leading-snug text-muted">Имя увидят те, кому вы отправите подборку. Регистрация не нужна.</p>
      <div className="mt-4 flex items-center gap-3">
        <CreatorAvatar author={{ avatar, tint, name }} size={64} ring />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {AVATARS.map((a) => (
              <button key={a} aria-label={`Аватар ${a}`} aria-pressed={avatar === a} onClick={() => setAvatar(a)} className={cn("press hit relative grid h-9 w-9 place-items-center rounded-full text-[20px]", avatar === a ? "bg-ink/10 ring-2 ring-inset ring-ink" : "bg-fill")}>
                {a}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {TINTS.map((t) => (
              <button key={t} aria-label="Цвет" aria-pressed={tint === t} onClick={() => setTint(t)} className={cn("press h-6 w-6 rounded-full", tint === t && "ring-2 ring-ink ring-offset-2")} style={{ background: t }} />
            ))}
          </div>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="text-[14px] font-semibold text-ink-2">Имя</span>
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Например: Мама Маша" className="mt-1.5 h-12 w-full rounded-[16px] bg-fill px-4 text-[16px] outline-none focus:ring-2 focus:ring-pink/40" />
      </label>
      <label className="mt-3 block">
        <span className="text-[14px] font-semibold text-ink-2">Ник для ссылки</span>
        <div className="mt-1.5 flex h-12 items-center rounded-[16px] bg-fill px-4 focus-within:ring-2 focus-within:ring-pink/40">
          <span className="text-muted">@</span>
          <input value={handle} maxLength={30} onChange={(e) => { setTouched(true); setUsername(e.target.value.toLowerCase()); }} aria-label="Ник" className="min-w-0 flex-1 bg-transparent pl-1 text-[16px] outline-none" />
        </div>
        {name.trim().length >= 2 && err && <span className="mt-1 block text-[13px] text-red-ink">{err}</span>}
      </label>
      <button
        disabled={!!err}
        onClick={() => onSave({ name, username: handle, avatar, tint })}
        className="press mt-5 h-14 w-full rounded-full bg-pink text-[18px] font-bold text-white shadow-pink disabled:opacity-40 disabled:shadow-none"
      >
        Опубликовать
      </button>
      {onAccount && (
        <button onClick={onAccount} className="press mt-3 w-full rounded-[18px] bg-fill-2 p-3 text-left ring-1 ring-line">
          <span className="block text-[15px] font-semibold">Или создайте кабинет</span>
          <span className="block text-[13px] leading-snug text-muted">Подборки сохранятся на любом телефоне, а ссылка станет короткой. Нужны только ник и пароль.</span>
        </button>
      )}
    </BottomSheet>
  );
}
