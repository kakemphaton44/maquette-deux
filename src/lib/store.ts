import { useSyncExternalStore } from "react";
import type { Analysis } from "./analyses";

// Analyses conservées dans ce navigateur uniquement.
const KEY = "contre-feu:analyses-v3";
const NAME_KEY = "contre-feu:nom";
const listeners = new Set<() => void>();
let cache: Analysis[] | null = null;
const EMPTY: Analysis[] = [];

function read(): Analysis[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    cache = [];
  }
  return cache!;
}
function write(list: Analysis[]) {
  cache = list;
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cache = null; l(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useAnalyses(): Analysis[] | null {
  const v = useSyncExternalStore(subscribe, read, () => EMPTY);
  return v === EMPTY ? null : v;
}
export function useHydratedAnalyses() {
  return useSyncExternalStore(subscribe, read, () => null as unknown as Analysis[]);
}
export function saveAnalysis(a: Analysis) {
  const list = read();
  const next = { ...a, updatedAt: new Date().toISOString() };
  write(list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? next : x)) : [next, ...list]);
}
export function deleteAnalysis(id: string) {
  write(read().filter((x) => x.id !== id));
}
export function exportAll() {
  return JSON.stringify(read(), null, 2);
}
export function importAll(json: string) {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Fichier invalide");
  const ids = new Set(read().map((a) => a.id));
  write([...data.filter((a: Analysis) => a && a.id && !ids.has(a.id)), ...read()]);
}

const nameListeners = new Set<() => void>();
export function useUserName() {
  return useSyncExternalStore(
    (l) => { nameListeners.add(l); return () => nameListeners.delete(l); },
    () => localStorage.getItem(NAME_KEY) || "",
    () => "",
  );
}
export function setUserName(n: string) {
  localStorage.setItem(NAME_KEY, n);
  nameListeners.forEach((l) => l());
}
