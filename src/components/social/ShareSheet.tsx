"use client";

import { useEffect, useRef } from "react";
import { Send, MessageCircle, Link2, Share2, Copy } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SmartImage } from "@/components/ui/SmartImage";
import { useToast } from "@/components/ui/Toast";
import { canNativeShare, copyText, nativeShare, telegramLink, whatsappLink, type ShareChannel, type UtmParams } from "@/lib/social/share";
import { trackEvent } from "@/lib/social/events";
import type { CoverTile } from "@/lib/social/catalog";

export interface ShareTarget {
  kind: "collection" | "place" | "creator";
  heading: string;
  text: string;
  /** Адрес с метками канала: так видно, откуда пришли люди. */
  buildUrl: (utm: UtmParams) => string;
  preview: { tile?: CoverTile; title: string; subtitle?: string };
  ids: { creator_id?: string; collection_id?: string; place_id?: string };
}

const utmFor = (channel: ShareChannel, kind: ShareTarget["kind"]): UtmParams => ({
  utm_source: channel,
  utm_medium: kind === "place" ? "friend_invite" : "share",
  utm_campaign: kind === "collection" ? "collection_share" : kind === "creator" ? "creator_share" : "place_invite",
});

/**
 * Системное меню «Поделиться» (Web Share API), Telegram, WhatsApp и «Скопировать ссылку».
 * Для Instagram честно предлагаем системное меню или ссылку для вставки — выдуманной интеграции нет.
 */
export function ShareSheet({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const opened = useRef<ShareTarget | null>(null);

  useEffect(() => {
    if (target && opened.current !== target) {
      opened.current = target;
      if (target.kind !== "creator") trackEvent(target.kind === "collection" ? "collection_share" : "place_invite_friends", { ...target.ids });
    }
    if (!target) opened.current = null;
  }, [target]);

  if (!target) return null;
  const t = target;
  const channel = (c: ShareChannel) => {
    trackEvent("share_channel", { ...t.ids, channel: c, kind: t.kind });
  };
  const url = (c: ShareChannel) => t.buildUrl(utmFor(c, t.kind));

  return (
    <BottomSheet open onClose={onClose} title={t.heading}>
      <div className="flex items-center gap-3 rounded-[20px] bg-fill-2 p-2.5 ring-1 ring-line">
        {t.preview.tile && <SmartImage photo={t.preview.tile.photo} tint={t.preview.tile.tint} emoji={t.preview.tile.emoji} sizes="64px" className="h-16 w-16 shrink-0 rounded-[12px]" />}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[16px] font-semibold leading-tight">{t.preview.title}</p>
          {t.preview.subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{t.preview.subtitle}</p>}
        </div>
      </div>

      {canNativeShare() && (
        <button
          onClick={async () => {
            channel("native");
            if (await nativeShare({ title: t.preview.title, text: t.text, url: url("native") })) onClose();
          }}
          className="press mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-pink text-[18px] font-bold text-white shadow-pink"
        >
          <Share2 size={20} /> Отправить…
        </button>
      )}

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <a
          href={telegramLink(url("telegram"), t.text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => channel("telegram")}
          className="press flex flex-col items-center gap-1.5 rounded-[20px] bg-sky-50 px-2 py-3.5 text-[14px] font-semibold text-sky-ink"
        >
          <Send size={24} /> Telegram
        </a>
        <a
          href={whatsappLink(url("whatsapp"), t.text)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => channel("whatsapp")}
          className="press flex flex-col items-center gap-1.5 rounded-[20px] bg-green-50 px-2 py-3.5 text-[14px] font-semibold text-green-ink"
        >
          <MessageCircle size={24} /> WhatsApp
        </a>
        <button
          onClick={async () => {
            channel("copy");
            const ok = await copyText(url("copy"));
            if (t.kind === "collection") trackEvent("collection_copy_link", { ...t.ids, kind: t.kind });
            toast(ok ? "Ссылка скопирована — вставьте в Instagram, сообщение или Stories 💌" : "Не получилось скопировать — выделите ссылку ниже");
          }}
          className="press flex flex-col items-center gap-1.5 rounded-[20px] bg-fill px-2 py-3.5 text-[14px] font-semibold text-ink"
        >
          <Link2 size={24} /> Ссылка
        </button>
      </div>

      <label className="mt-3.5 flex items-center gap-2 rounded-full bg-fill px-3.5">
        <span className="sr-only">Ссылка</span>
        <input readOnly value={url("copy")} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink-2 outline-none" />
        <Copy size={16} className="shrink-0 text-muted" />
      </label>
      <p className="mt-2.5 pb-1 text-center text-[13px] text-muted">Для Instagram: скопируйте ссылку и вставьте в сообщение или Stories</p>
    </BottomSheet>
  );
}
