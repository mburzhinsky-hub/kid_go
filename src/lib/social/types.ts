/**
 * Модель «Авторские подборки + Хочу сюда + атрибуция».
 * Поля повторяют prisma/schema.prisma (раздел «Creators & Collections»): локальный слой данных
 * отдаёт ровно эти формы, поэтому переход на БД не меняет UI.
 */
import type { Photo } from "@/lib/types";

export type UserType = "USER" | "CREATOR" | "ADMIN";
export type CreatorStatus = "PENDING" | "APPROVED" | "SUSPENDED";
export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type CollectionStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

export interface User {
  id: string;
  name: string;
  username: string;
  /** Эмодзи-аватар или адрес картинки. */
  avatar: string;
  type: UserType;
  bio?: string;
}

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  username: string;
  bio: string;
  avatar: string;
  /** Цвет подложки аватара. */
  tint: string;
  featured: boolean;
  status: CreatorStatus;
  city: string;
  /** Ссылки на соцсети автора (показываются на странице профиля). */
  links?: { kind: "instagram" | "telegram" | "site"; url: string; label: string }[];
}

/** Обложка: фото одного из мест или автоколлаж из первых мест. */
export type CollectionCover = { kind: "place"; slug: string } | { kind: "collage" };

export interface Collection {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string;
  cover: CollectionCover;
  /** Для обложки, если место недоступно (или в снимке по ссылке). */
  cover_image?: Photo;
  city: string;
  visibility: Visibility;
  status: CollectionStatus;
  age_min: number;
  age_max: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
  items: CollectionItem[];
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  place_id: string; // slug места (в БД — id)
  position: number;
  creator_note?: string;
}

export interface CollectionSave {
  id: string;
  user_id?: string;
  anonymous_id: string;
  collection_id: string;
  created_at: string;
}

export type IntentStatus = "WANT_TO_GO" | "VISITED" | "REMOVED";
export type IntentSource = "COLLECTION" | "PLACE" | "MAP" | "ADVENTURE" | "HOME" | "SEARCH" | "CREATOR";
export type IntentFeedback = "LIKE" | "OK" | "DISLIKE";

/** Намерение сходить — отдельная сущность, а не лайк: помнит, откуда пришло и чья подборка привела. */
export interface PlaceIntent {
  id: string;
  user_id?: string;
  anonymous_session_id?: string;
  place_id: string;
  status: IntentStatus;
  source_type: IntentSource;
  source_id?: string;
  creator_id?: string;
  collection_id?: string;
  /** Подготовлено для «Понравилось?» после посещения. */
  feedback?: IntentFeedback;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  creator_id?: string;
  collection_id?: string;
  anonymous_id: string;
  user_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
  created_at: string;
}

/** Касание: последняя точка входа через автора. Окно атрибуции — 30 дней (см. attribution.ts). */
export interface AttributionTouch {
  creator_id?: string;
  collection_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  landing_path?: string;
  at: number;
}

export type EventName =
  | "creator_profile_view"
  | "collection_view"
  | "collection_scroll"
  | "collection_place_view"
  | "collection_place_open"
  | "collection_save"
  | "collection_unsave"
  | "collection_share"
  | "collection_copy_link"
  | "collection_map_open"
  | "collection_create_started"
  | "collection_created"
  | "collection_published"
  | "collection_app_open_click"
  | "collection_app_install_click"
  | "place_want_to_go"
  | "place_want_to_go_remove"
  | "place_visited"
  | "place_invite_friends"
  | "creator_follow"
  | "creator_unfollow"
  | "share_channel"
  // зарезервировано под партнёрскую выручку и B2B (события появятся вместе с билетами и бронью)
  | "ticket_click"
  | "booking_click"
  | "purchase"
  | "partner_conversion"
  | "creator_conversion"
  | "creator_revenue";

export interface AnalyticsEvent {
  id: string;
  event_name: EventName;
  user_id?: string;
  anonymous_id: string;
  creator_id?: string;
  collection_id?: string;
  place_id?: string;
  properties: Record<string, string | number | boolean | undefined>;
  created_at: string;
}

/** Куда ведёт обращение к автору. */
export interface CollectionStats {
  views: number;
  saves: number;
  shares: number;
  placeOpens: number;
  wantToGo: number;
  appClicks: number;
  maps: number;
}

export interface PlaceInterest {
  place_id: string;
  want: number;
  opens: number;
}

/** Подпись автора на карточке и странице. Хранится в снимке подборки, поэтому читается и без сервера. */
export interface AuthorRef {
  id: string;
  name: string;
  username: string;
  avatar: string;
  tint: string;
  /** Автор из демо-каталога: у него есть собственная страница `/@username`. */
  hasPage?: boolean;
}

export type CollectionSource = "seed" | "local" | "snapshot";

/** Подборка вместе с автором и происхождением данных. */
export interface ResolvedCollection {
  collection: Collection;
  author: AuthorRef;
  source: CollectionSource;
}
