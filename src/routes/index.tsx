import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AppHeader, Btn, Card, Chip, Field, Pill, Required, RequiredLegend, inputCls } from "@/components/cf/ui";
import { KIND, NO_FILTER, STATUS, STEPS, filterAnalyses, launchMissing, nameFormatError, newAnalysis, reviewStats, status, titleOf, type Analysis, type AnalysisFilter, type Kind, type Status } from "@/lib/analyses";
import { deleteAnalysis, exportAll, importAll, saveAnalysis, setUserName, useAnalyses, useUserName } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Aide à la décision pour Product Managers" },
      { name: "description", content: "Contre-feu lit la situation, propose une tendance argumentée, puis fait attaquer chaque option, avant que vous ne décidiez." },
      { property: "og:title", content: "Contre-feu — Un signal vient d’arriver ?" },
      { property: "og:description", content: "Mouvement concurrent ou détournement d’usage : une décision argumentée, sans que l’IA décide à votre place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const fmt = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const toneOf = (s: Status) => (s === "evaluee" ? "success" : s === "bloquee" ? "accent" : "muted");

function Home() {
  const list = useAnalyses();
  const name = useUserName();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [err, setErr] = useState<("nom" | "situation")[]>([]);
  const [f, setF] = useState<AnalysisFilter>(NO_FILTER);
  const start = (k: Kind | null) => {
    const missing = launchMissing(name, k);
    if (missing.length) {
      setErr(missing);
      if (missing.includes("nom")) document.getElementById("cf-name")?.focus();
      return;
    }
    const a = newAnalysis(k!, crypto.randomUUID(), new Date());
    saveAnalysis(a);
    navigate({ to: "/analyse/$id", params: { id: a.id } });
  };
  const resume = list?.find((a) => ["en_cours", "eval_incomplete", "bloquee"].includes(status(a)));
  const bilan = list ? reviewStats(list) : null;
  const shown = list ? filterAnalyses(list, f) : null;
  const filtered = f.q.trim() !== "" || f.kind !== "tous" || f.status !== "tous";
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="w-full space-y-8 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        <section className="grid gap-6 rounded-[2rem] bg-primary p-5 text-primary-foreground sm:gap-8 sm:rounded-[2rem] sm:p-10 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-wider text-highlight">Aide à la décision · Product Managers SaaS B2B</p>
            <h1 className="text-5xl leading-[1.05] sm:text-7xl">Contre<em className="text-highlight">–</em>feu</h1>
            <p className="max-w-xl text-lg text-primary-foreground/80">Contre-feu lit la situation, propose une tendance argumentée, puis fait attaquer chaque option, avant que vous ne décidiez.</p>
            <div className="max-w-lg space-y-4">
              <RequiredLegend onDark />
              <Field required onDark show={err.includes("nom")} error={nameFormatError(name)} label="Votre nom pour cette séance" hint="Le nom reste dans votre navigateur et apparaît dans la synthèse.">
                <input id="cf-name" className={inputCls + " text-foreground"} value={name} placeholder="Prénom ou initiales" onChange={(e) => { setUserName(e.target.value); if (e.target.value.trim() && !nameFormatError(e.target.value)) setErr((x) => x.filter((m) => m !== "nom")); }} />
              </Field>
              <div className="space-y-2">
                <span className="block font-bold">Type de situation<Required onDark kind="choice" /></span>
                <div role="group" aria-label="Type de situation" aria-required="true" aria-invalid={err.includes("situation") || undefined} className={cn("flex flex-wrap gap-2", err.includes("situation") && "cf-invalid rounded-[1.75rem] outline-2 outline-offset-4 outline-highlight")}>
                  {(Object.keys(KIND) as Kind[]).map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setErr((x) => x.filter((m) => m !== "situation")); }}
                      className={cn("min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors", kind === k ? "bg-highlight text-primary" : "border-2 border-primary-foreground/25 text-primary-foreground/85 hover:border-primary-foreground/50 hover:text-primary-foreground")}>
                      {KIND[k].name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Btn variant="accent" aria-disabled={launchMissing(name, kind).length > 0 || undefined} onClick={() => start(kind)}>Lancer l’analyse →</Btn>
                {err.length > 0 && launchMissing(name, kind).length > 0 && <span role="alert" className="cf-error-msg text-sm font-bold text-highlight">Renseignez votre nom et choisissez un type de situation.</span>}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {resume && (
              <Link to="/analyse/$id" params={{ id: resume.id }} className="block rounded-3xl bg-primary-foreground/10 p-5 text-primary-foreground no-underline hover:bg-primary-foreground/15">
                <p className="text-xs font-bold uppercase tracking-wider text-highlight">Dernière analyse à reprendre</p>
                <p className="mt-1 font-display text-2xl">{titleOf(resume)}</p>
                <p className="text-sm text-primary-foreground/70">{STATUS[status(resume)].glyph} {STATUS[status(resume)].label} · {STEPS[resume.step]?.label}</p>
                <p className="mt-2 text-sm font-bold">{status(resume) === "eval_incomplete" ? "Finir l’évaluation" : status(resume) === "bloquee" ? "Débloquer" : "Reprendre"} →</p>
              </Link>
            )}
            <p className="text-sm text-primary-foreground/70">Contre-feu ne décide jamais à votre place : la recommandation de l’IA et votre décision restent distinctes.</p>
          </div>
        </section>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">Historique</p>
              <h2 className="text-2xl text-primary sm:text-3xl">Mes analyses <span className="font-mono text-xl text-muted-foreground">{list?.length ?? ""}</span></h2>
              <p className="max-w-2xl text-sm text-muted-foreground">Retrouvez vos analyses et reprenez un travail interrompu. Une analyse terminée ou abandonnée s’ouvre en consultation seule : son contenu ne peut plus être modifié.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {list && list.length > 0 && <Btn variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([exportAll()], { type: "application/json" })); const l = document.createElement("a"); l.href = url; l.download = "contre-feu-analyses.json"; l.click(); URL.revokeObjectURL(url); }}><Download className="h-4 w-4" /> Exporter</Btn>}
              <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Importer</Btn>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f2 = e.target.files?.[0]; if (!f2) return; try { importAll(await f2.text()); } catch { window.alert("Ce fichier n’est pas un export Contre-feu."); } e.target.value = ""; }} />
            </div>
          </div>

          {bilan && bilan.count > 0 && (
            <div className="mt-6 rounded-2xl bg-muted p-5">
              <p className="font-bold">Ce que vos revues vous apprennent · {bilan.count}</p>
              <div className="mt-2 flex flex-wrap gap-6 text-sm"><span><strong className="font-mono text-lg">{bilan.oui}</strong> décision tient</span><span><strong className="font-mono text-lg">{bilan.partie}</strong> en partie</span><span><strong className="font-mono text-lg">{bilan.non}</strong> ne tient pas</span></div>
              <p className="mt-2 text-xs text-muted-foreground">Indicatif : une tendance se lit à partir de cinq revues.</p>
            </div>
          )}

          {list && list.length > 0 && (
            <div className="mt-6 space-y-3">
              <label className="block max-w-md space-y-1">
                <span className="text-sm font-bold">Rechercher</span>
                <input className={inputCls} value={f.q} placeholder="Titre, signal, décision…" onChange={(e) => setF({ ...f, q: e.target.value })} />
              </label>
              <div role="group" aria-label="Filtrer par type de situation" className="flex flex-wrap gap-2">
                <Chip on={f.kind === "tous"} onClick={() => setF({ ...f, kind: "tous" })}>Tous les types</Chip>
                {(Object.keys(KIND) as Kind[]).map((k) => <Chip key={k} on={f.kind === k} onClick={() => setF({ ...f, kind: k })}>{KIND[k].name}</Chip>)}
              </div>
              <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
                <Chip on={f.status === "tous"} onClick={() => setF({ ...f, status: "tous" })}>Tous les statuts</Chip>
                {(Object.keys(STATUS) as Status[]).map((s) => <Chip key={s} on={f.status === s} onClick={() => setF({ ...f, status: s })}>{STATUS[s].glyph} {STATUS[s].label}</Chip>)}
              </div>
              <p className="text-sm text-muted-foreground">
                {shown?.length ?? 0} analyse{(shown?.length ?? 0) > 1 ? "s" : ""} affichée{(shown?.length ?? 0) > 1 ? "s" : ""} sur {list.length}
                {filtered && <button type="button" onClick={() => setF(NO_FILTER)} className="ml-3 font-bold text-accent">Réinitialiser</button>}
              </p>
            </div>
          )}

          {list && list.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-input p-6 text-center sm:p-10">
              <p className="font-display text-2xl text-primary">Aucune analyse pour l’instant</p>
              <p className="mt-2 text-muted-foreground">Quand un signal arrive — une bêta chez un concurrent, un usage inattendu de votre produit — lancez une analyse.</p>
            </div>
          ) : shown && shown.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-input p-6 text-center sm:p-10">
              <p className="font-display text-2xl text-primary">Aucune analyse ne correspond</p>
              <p className="mt-2 text-muted-foreground">Changez de mot ou retirez un filtre.</p>
            </div>
          ) : (
            <>
              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-4">Analyse</th><th className="pr-4">Situation</th><th className="pr-4">Statut</th><th className="pr-4">Créée le</th><th className="pr-4">Modifiée le</th><th className="pr-4">Action</th><th /></tr></thead>
                  <tbody>{shown?.map((a) => <Row key={a.id} a={a} />)}</tbody>
                </table>
              </div>
              <div className="mt-6 space-y-3 md:hidden">
                {shown?.map((a) => <MobileRow key={a.id} a={a} />)}
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">{Object.values(STATUS).map((s) => <span key={s.label}><strong>{s.glyph} {s.label}</strong> : {s.def}</span>)}</div>
        </Card>
      </main>
    </div>
  );
}

function Actions({ a }: { a: Analysis }) {
  const s = status(a);
  const done = s === "evaluee" || s === "abandonnee";
  return (
    <>
      {s === "evaluee" ? <Link to="/synthese/$id" params={{ id: a.id }} className="font-bold text-accent">Consulter</Link> : <Link to="/analyse/$id" params={{ id: a.id }} className="font-bold text-accent">{done ? "Consulter" : s === "bloquee" ? "Relancer" : "Reprendre"}</Link>}
      {s === "evaluee" && <Link to="/revue/$id" params={{ id: a.id }} className="font-bold text-accent">{a.review ? "Revoir la revue" : "Faire la revue"}</Link>}
    </>
  );
}

function Row({ a }: { a: Analysis }) {
  const s = status(a);
  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 font-bold">{titleOf(a)}</td>
      <td className="pr-4">{KIND[a.kind].name}</td>
      <td className="pr-4"><Pill tone={toneOf(s)}>{STATUS[s].glyph} {STATUS[s].label}</Pill></td>
      <td className="pr-4">{fmt(a.createdAt)}</td>
      <td className="pr-4">{fmt(a.updatedAt)}</td>
      <td className="space-x-3 pr-4"><Actions a={a} /></td>
      <td><button type="button" aria-label="Supprimer l’analyse" className="rounded-full p-2 text-muted-foreground hover:bg-muted" onClick={() => { if (window.confirm(`Supprimer « ${titleOf(a)} » ?`)) deleteAnalysis(a.id); }}><Trash2 className="h-4 w-4" /></button></td>
    </tr>
  );
}

function MobileRow({ a }: { a: Analysis }) {
  const s = status(a);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="min-w-0 break-words font-bold">{titleOf(a)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{KIND[a.kind].name} · créée le {fmt(a.createdAt)} · modifiée le {fmt(a.updatedAt)}</p>
      <div className="mt-2"><Pill tone={toneOf(s)}>{STATUS[s].glyph} {STATUS[s].label}</Pill></div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Actions a={a} />
        <button type="button" className="font-bold text-muted-foreground" onClick={() => { if (window.confirm(`Supprimer « ${titleOf(a)} » ?`)) deleteAnalysis(a.id); }}>Supprimer</button>
      </div>
    </div>
  );
}
