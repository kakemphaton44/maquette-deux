import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppHeader, Btn, Card, Pill, inputCls } from "@/components/cf/ui";
import { KIND_LABEL, STATUS_LABEL, STEPS, reviewStats, status, type Analysis, type Status } from "@/lib/analyses";
import { deleteAnalysis, exportAll, importAll, useAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Mes analyses" },
      { name: "description", content: "Contre-feu fait attaquer vos options par ceux qu’elles touchent, avant que vous ne tranchiez." },
      { property: "og:title", content: "Contre-feu — Mes analyses" },
      { property: "og:description", content: "Une décision argumentée en 30 minutes, face à un signal concurrent ou un détournement d’usage." },
    ],
  }),
  component: Home,
});

const GROUPS: { id: string; label: string; test: (s: Status) => boolean }[] = [
  { id: "all", label: "Toutes", test: () => true },
  { id: "open", label: "À reprendre", test: (s) => s === "en_cours" || s === "eval_incomplete" || s === "revue_a_faire" },
  { id: "done", label: "Terminées", test: (s) => s === "terminee" || s === "revue" || s === "abandonnee" },
];
const PRIORITY: Record<Status, number> = { revue_a_faire: 0, eval_incomplete: 1, en_cours: 2, terminee: 3, revue: 4, abandonnee: 5 };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function Home() {
  const list = useAnalyses();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [kind, setKind] = useState<"all" | Analysis["kind"]>("all");
  const [sort, setSort] = useState<"action" | "date">("action");
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  const rows = useMemo(() => {
    if (!list) return [];
    const g = GROUPS.find((x) => x.id === group)!;
    return list
      .map((a) => ({ a, s: status(a, now) }))
      .filter(({ a, s }) => g.test(s) && (kind === "all" || a.kind === kind) && (!q || (a.title + " " + a.signal).toLowerCase().includes(q.toLowerCase())))
      .sort((x, y) => (sort === "date" ? y.a.updatedAt.localeCompare(x.a.updatedAt) : PRIORITY[x.s] - PRIORITY[y.s] || y.a.updatedAt.localeCompare(x.a.updatedAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, q, group, kind, sort]);

  const stats = list ? reviewStats(list) : null;
  const dueReview = list?.filter((a) => status(a, now) === "revue_a_faire") ?? [];

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="grid gap-6 rounded-[2rem] bg-primary p-10 text-primary-foreground md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <h1 className="text-5xl leading-tight">
              Un signal vient <em className="text-highlight">d’arriver</em> ?
            </h1>
            <p className="max-w-xl text-lg text-primary-foreground/80">
              Contre-feu fait attaquer vos options par ceux qu’elles touchent, avant que vous ne tranchiez. Une décision argumentée en 30 minutes.
            </p>
            <Link to="/nouvelle" className="inline-flex min-h-12 items-center rounded-full bg-highlight px-6 font-bold text-primary no-underline">
              Nouvelle analyse →
            </Link>
          </div>
          <div className="rounded-3xl bg-primary-foreground/10 p-6">
            <h2 className="text-2xl">Ce que vos revues vous apprennent</h2>
            {stats && stats.reviewed > 0 ? (
              <div className="mt-4 space-y-2 text-primary-foreground/90">
                <p className="text-sm">{stats.reviewed} décision{stats.reviewed > 1 ? "s" : ""} revue{stats.reviewed > 1 ? "s" : ""} sur {stats.total} analyses</p>
                <p><strong className="font-mono text-highlight">{stats.tenu}</strong> a tenu telle quelle</p>
                <p><strong className="font-mono text-highlight">{stats.partiel}</strong> n’a tenu qu’en partie</p>
                <p><strong className="font-mono text-highlight">{stats.pasTenu}</strong> n’a pas tenu</p>
                {stats.reviewed < 5 && <p className="text-xs text-primary-foreground/60">Indicatif : une tendance se lit à partir de cinq revues.</p>}
              </div>
            ) : (
              <p className="mt-4 text-primary-foreground/80">Trente jours après chaque décision, Contre-feu vous propose une revue : a-t-elle tenu ? Vos résultats s’afficheront ici.</p>
            )}
            {dueReview.length > 0 && (
              <Link to="/revue/$id" params={{ id: dueReview[0]!.id }} className="mt-4 inline-flex rounded-full bg-highlight px-4 py-2 text-sm font-bold text-primary no-underline">
                {dueReview.length} revue{dueReview.length > 1 ? "s" : ""} à faire →
              </Link>
            )}
          </div>
        </section>

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl text-primary">Mes analyses</h2>
              <p className="text-muted-foreground">
                {list ? `${list.length} analyse${list.length > 1 ? "s" : ""} · enregistrées dans ce navigateur` : "Chargement…"}
              </p>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => {
                const blob = new Blob([exportAll()], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "contre-feu-analyses.json"; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="h-4 w-4" /> Exporter
              </Btn>
              <Btn variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Importer
              </Btn>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { importAll(await f.text()); } catch { window.alert("Ce fichier n’est pas un export Contre-feu."); }
                e.target.value = "";
              }} />
            </div>
          </div>

          {list && list.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-input p-10 text-center">
              <p className="font-display text-2xl text-primary">Aucune analyse pour l’instant</p>
              <p className="mt-2 text-muted-foreground">Décrivez votre premier signal : il faut environ deux minutes.</p>
              <Link to="/nouvelle" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-5 font-bold text-primary-foreground no-underline">Commencer</Link>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="relative min-w-60 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input aria-label="Rechercher une analyse" className={cn(inputCls, "pl-10")} placeholder="Rechercher une analyse" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <select aria-label="Trier par" className={cn(inputCls, "w-auto")} value={sort} onChange={(e) => setSort(e.target.value as "action" | "date")}>
                  <option value="action">À traiter d’abord</option>
                  <option value="date">Plus récentes</option>
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {GROUPS.map((g) => (
                  <FilterChip key={g.id} on={group === g.id} onClick={() => setGroup(g.id)}>
                    {g.label} <span className="opacity-60">{list?.filter((a) => g.test(status(a, now))).length ?? 0}</span>
                  </FilterChip>
                ))}
                <span className="mx-2 w-px bg-border" />
                {(["all", "concurrent", "detournement"] as const).map((k) => (
                  <FilterChip key={k} on={kind === k} onClick={() => setKind(k)}>
                    {k === "all" ? "Tous types" : KIND_LABEL[k]}
                  </FilterChip>
                ))}
              </div>
              <ul className="mt-6 space-y-3">
                {rows.map(({ a, s }) => <Row key={a.id} a={a} s={s} />)}
                {list && rows.length === 0 && (
                  <li className="rounded-2xl bg-muted p-6 text-center">
                    Aucune analyse ne correspond.{" "}
                    <button type="button" className="font-bold text-accent" onClick={() => { setQ(""); setGroup("all"); setKind("all"); }}>Effacer les filtres</button>
                  </li>
                )}
              </ul>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn("min-h-10 rounded-full px-4 text-[15px]", on ? "bg-primary font-bold text-primary-foreground" : "border-2 border-border bg-card")}>
      {children}
    </button>
  );
}

function Row({ a, s }: { a: Analysis; s: Status }) {
  const action =
    s === "revue_a_faire" ? { label: "Faire la revue", to: "/revue/$id" as const } :
    s === "en_cours" || s === "eval_incomplete" ? { label: "Reprendre", to: "/analyse/$id" as const } :
    { label: "Consulter", to: "/synthese/$id" as const };
  const detail = a.completedAt ? `décision : ${a.decision?.toLowerCase()}` : a.abandoned ? "abandonnée" : `étape ${a.step + 1} sur ${STEPS.length} · ${STEPS[a.step]}`;
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl font-display text-xl", a.kind === "concurrent" ? "bg-secondary text-accent" : "bg-success-soft text-success")}>
        {a.kind === "concurrent" ? "C" : "D"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{a.title || "Analyse sans titre"}</p>
        <p className="text-sm text-muted-foreground">{KIND_LABEL[a.kind]} · {detail} · {fmt(a.updatedAt)}</p>
      </div>
      <Pill tone={s === "revue_a_faire" ? "primary" : s === "terminee" || s === "revue" ? "success" : s === "abandonnee" ? "muted" : "accent"}>{STATUS_LABEL[s]}</Pill>
      <Link to={action.to} params={{ id: a.id }} className={cn("inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold no-underline", s === "revue_a_faire" || s === "eval_incomplete" ? "bg-primary text-primary-foreground" : "border-2 border-border text-foreground")}>
        {action.label}
      </Link>
      <button type="button" aria-label="Supprimer l’analyse" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => {
        if (window.confirm(`Supprimer « ${a.title || "Analyse sans titre"} » ? Cette action est définitive.`)) deleteAnalysis(a.id);
      }}>
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
