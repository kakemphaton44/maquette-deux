import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { keyToSlug, slugToKey, type ScreenKey } from "./screens-map";

const templates = import.meta.glob("./templates/*.html", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

let runtime: Promise<void> | null = null;
const loadRuntime = () =>
  (runtime ??= import("./engine.js").then(() => import("./screens.js")).then(() => undefined));

export function MockupScreen({ screen }: { screen: ScreenKey }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadRuntime(), templates[`./templates/${screen}.html`]!()]).then(([, html]) => {
      if (cancelled || !rootRef.current) return;
      const tpl = document.createElement("template");
      tpl.innerHTML = html;
      const w = window as unknown as {
        cfMount: (k: unknown, t: HTMLTemplateElement, r: HTMLElement) => void;
        SCREENS: Record<string, unknown>;
      };
      w.cfMount(w.SCREENS[screen], tpl, rootRef.current);
      window.scrollTo(0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  // Les liens de la maquette (#M2_Xxx) deviennent des pages de l'application.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href");
      if (!href?.startsWith("#")) return;
      const key = href.slice(1);
      if (key === "plan" || key === "") {
        ev.preventDefault();
        navigate({ to: "/" });
        return;
      }
      if (slugToKey(keyToSlug(key))) {
        ev.preventDefault();
        const slug = keyToSlug(key);
        if (slug) navigate({ to: "/$screen", params: { screen: slug } });
        else navigate({ to: "/" });
      }
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [navigate]);

  return <div ref={rootRef} className="min-h-screen bg-background" />;
}
