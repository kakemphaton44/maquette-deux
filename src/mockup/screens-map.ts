import titles from "./titles.json";

/** Écrans de la maquette v2 : clé du template -> chemin d'URL. */
export const SCREEN_KEYS = Object.keys(titles) as (keyof typeof titles)[];
export type ScreenKey = (typeof SCREEN_KEYS)[number];
export const TITLES = titles as Record<ScreenKey, string>;

export const keyToSlug = (k: string) =>
  k === "M2_Accueil" ? "" : k.replace(/^M2_/, "").toLowerCase();
export const slugToKey = (slug: string): ScreenKey | undefined =>
  SCREEN_KEYS.find((k) => keyToSlug(k) === slug.toLowerCase());
