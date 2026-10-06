"use client";

import { createContext, useContext } from "react";
import type { IntentSource } from "./types";

/** Экран сообщает карточкам, откуда будет намерение «Хочу сюда»: подборка, карта, приключение, главная… */
export interface IntentSourceValue {
  source_type: IntentSource;
  source_id?: string;
  creator_id?: string;
  collection_id?: string;
}

const Ctx = createContext<IntentSourceValue | undefined>(undefined);
export const IntentSourceProvider = Ctx.Provider;
export const useIntentSource = () => useContext(Ctx);
