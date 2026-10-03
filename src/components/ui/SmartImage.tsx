"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  photo: Photo;
  tint?: string;
  emoji?: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  quality?: number;
}

/**
 * Фото с фирменной подложкой: пока грузится — цветной тинт,
 * если не загрузилось (офлайн/битая ссылка) — яркая иллюстрация, а не серый плейсхолдер.
 */
export function SmartImage({ photo, tint = "#FFE3EE", emoji = "✨", sizes, priority, className, imgClassName, quality }: Props) {
  const [failed, setFailed] = useState(!photo.src);
  const imgRef = useRef<HTMLImageElement>(null);
  // Ошибка могла случиться до гидрации (React не повторяет onError) — проверяем вручную.
  useEffect(() => {
    const img = imgRef.current;
    // только для eager-картинок: у отложенных lazy Chrome тоже отдаёт complete=true
    if (img && img.loading !== "lazy" && img.complete && img.naturalWidth === 0 && img.currentSrc) setFailed(true);
  }, []);
  return (
    <div className={cn("overflow-hidden", !/\b(absolute|fixed)\b/.test(className ?? "") && "relative", className)} style={{ backgroundColor: tint }}>
      {failed ? (
        <Fallback tint={tint} emoji={emoji} />
      ) : (
        <Image
          ref={imgRef}
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          quality={quality}
          onError={() => setFailed(true)}
          className={cn("object-cover", imgClassName)}
        />
      )}
    </div>
  );
}

function Fallback({ tint, emoji }: { tint: string; emoji: string }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center"
      style={{
        containerType: "size",
        background: `radial-gradient(120% 90% at 20% 15%, #ffffffaa 0%, transparent 45%), radial-gradient(80% 80% at 90% 100%, ${tint} 0%, transparent 70%), linear-gradient(135deg, ${tint}, color-mix(in oklab, ${tint} 70%, #ff2e88 12%))`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden>
        <defs>
          <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" fill="#fff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>
      <span className="relative leading-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.12)]" style={{ fontSize: "clamp(14px, 46cqmin, 76px)" }}>
        {emoji}
      </span>
    </div>
  );
}
