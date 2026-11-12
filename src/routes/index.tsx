import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { AppHeader, Btn, Card, Pill, inputCls } from "@/components/cf/ui";
import { KIND, STATUS, STEPS, newAnalysis, reviewStats, status, titleOf, type Analysis, type Kind } from "@/lib/analyses";
import { deleteAnalysis, exportAll, importAll, saveAnalysis, setUserName, useAnalyses, useUserName } from "@/lib/store";

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

function Home() {
  const list = useAnalyses();
  const name = useUserName();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameErr, setNameErr] = useState(false);
  const start = (kind: Kind) => {
    if (!name.trim()) { setNameErr(true); document.getElementById("cf-name")?.focus(); return; }
    const a = newAnalysis(kind, crypto.randomUUID(), new Date());
    saveAnalysis(a);
    navigate({ to: "/analyse/$id", params: { id: a.id } });
  };
  const resume = list?.find((a) => ["en_cours", "eval_incomplete", "bloquee"].includes(status(a)));
  const bilan = list ? reviewStats(list) : null;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="w-full space-y-8 px-6 lg:px-10 py-10">
        <section className="grid gap-8 rounded-[2rem] bg-primary p-10 text-primary-foreground md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-wider text-highlight">Aide à la décision · Product Managers SaaS B2B</p>
            <h1 className="text-7xl leading-[1.05]">Contre<em className="text-highlight">–</em>feu</h1>
            <p className="max-w-xl text-lg text-primary-foreground/80">Contre-feu lit la situation, propose une tendance argumentée, puis fait attaquer chaque option, avant que vous ne décidiez.</p>
            <label className="block max-w-sm space-y-1">
              <span className="text-sm font-bold">Votre nom pour cette séance</span>
              <input id="cf-name" className={inputCls + " text-foreground"} value={name} placeholder="Prénom ou initiales" onChange={(e) => { setUserName(e.target.value); setNameErr(false); }} />
              {nameErr && <span className="block text-sm font-bold text-highlight">Indiquez un nom pour identifier l’auteur de l’analyse.</span>}
              <span className="block text-xs text-primary-foreground/70">Aucun compte, aucune connexion. Le nom reste dans votre navigateur, apparaît dans la synthèse et n’est jamais transmis à l’IA.</span>
            </label>
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

        <div className="grid gap-5 md:grid-cols-2">
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => start(k)} className="text-left">
              <Card className="h-full border-2 transition hover:-translate-y-1 hover:border-primary">
                <Pill>{KIND[k].code}</Pill>
                <h2 className="mt-3 text-3xl text-primary">{KIND[k].name}</h2>
                <p className="mt-2 text-muted-foreground">{KIND[k].intro}</p>
                <p className="mt-4 text-sm font-bold text-accent">Décisions possibles : {KIND[k].decisions.join(" · ")}</p>
                <p className="mt-4 font-bold text-primary">Nouvelle analyse →</p>
              </Card>
            </button>
          ))}
        </div>

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">Historique</p>
              <h2 className="text-3xl text-primary">Mes analyses <span className="font-mono text-xl text-muted-foreground">{list?.length ?? ""}</span></h2>
              <p className="max-w-2xl text-sm text-muted-foreground">Retrouvez vos analyses et reprenez un travail interrompu. Une analyse terminée ou abandonnée s’ouvre en consultation seule : son contenu ne peut plus être modifié.</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([exportAll()], { type: "application/json" })); const l = document.createElement("a"); l.href = url; l.download = "contre-feu-analyses.json"; l.click(); URL.revokeObjectURL(url); }}><Download className="h-4 w-4" /> Exporter</Btn>
              <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Importer</Btn>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { importAll(await f.text()); } catch { window.alert("Ce fichier n’est pas un export Contre-feu."); } e.target.value = ""; }} />
            </div>
          </div>

          {bilan && bilan.count > 0 && (
            <div className="mt-6 rounded-2xl bg-muted p-5">
              <p className="font-bold">Ce que vos revues vous apprennent · {bilan.count}</p>
              <div className="mt-2 flex flex-wrap gap-6 text-sm"><span><strong className="font-mono text-lg">{bilan.oui}</strong> décision tient</span><span><strong className="font-mono text-lg">{bilan.partie}</strong> en partie</span><span><strong className="font-mono text-lg">{bilan.non}</strong> ne tient pas</span></div>
              <p className="mt-2 text-xs text-muted-foreground">Indicatif : une tendance se lit à partir de cinq revues.</p>
            </div>
          )}

          {list && list.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-input p-10 text-center">
              <p className="font-display text-2xl text-primary">Aucune analyse pour l’instant</p>
              <p className="mt-2 text-muted-foreground">Quand un signal arrive — une bêta chez un concurrent, un usage inattendu de votre produit — lancez une analyse.</p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="py-2 pr-4">Analyse</th><th className="pr-4">Situation</th><th className="pr-4">Statut</th><th className="pr-4">Créée le</th><th className="pr-4">Modifiée le</th><th className="pr-4">Action</th><th /></tr></thead>
                <tbody>{list?.map((a) => <Row key={a.id} a={a} />)}</tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">{Object.values(STATUS).map((s) => <span key={s.label}><strong>{s.glyph} {s.label}</strong> : {s.def}</span>)}</div>
        </Card>
      </main>
    </div>
  );
}

function Row({ a }: { a: Analysis }) {
  const s = status(a);
  const done = s === "evaluee" || s === "abandonnee";
  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 font-bold">{titleOf(a)}</td>
      <td className="pr-4">{KIND[a.kind].name}</td>
      <td className="pr-4"><Pill tone={s === "evaluee" ? "success" : s === "bloquee" ? "accent" : "muted"}>{STATUS[s].glyph} {STATUS[s].label}</Pill></td>
      <td className="pr-4">{fmt(a.createdAt)}</td>
      <td className="pr-4">{fmt(a.updatedAt)}</td>
      <td className="space-x-3 pr-4">
        {s === "evaluee" ? <Link to="/synthese/$id" params={{ id: a.id }} className="font-bold text-accent">Consulter</Link> : <Link to="/analyse/$id" params={{ id: a.id }} className="font-bold text-accent">{done ? "Consulter" : s === "bloquee" ? "Relancer" : "Reprendre"}</Link>}
        {s === "evaluee" && <Link to="/revue/$id" params={{ id: a.id }} className="font-bold text-accent">{a.review ? "Revoir la revue" : "Faire la revue"}</Link>}
      </td>
      <td><button type="button" aria-label="Supprimer l’analyse" className="rounded-full p-2 text-muted-foreground hover:bg-muted" onClick={() => { if (window.confirm(`Supprimer « ${titleOf(a)} » ?`)) deleteAnalysis(a.id); }}><Trash2 className="h-4 w-4" /></button></td>
    </tr>
  );
}
