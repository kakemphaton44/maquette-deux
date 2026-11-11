import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, Printer } from "lucide-react";
import { useState } from "react";
import { AppHeader, Btn, Card, Pill } from "@/components/cf/ui";
import { Missing } from "@/components/cf/Missing";
import { CONF, KIND, filled, outcome, synthesisText, titleOf, trend } from "@/lib/analyses";
import { useAnalyses, useUserName } from "@/lib/store";

export const Route = createFileRoute("/synthese/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Synthèse de décision" },
      { name: "description", content: "La recommandation de l’IA et la décision du PM, présentées séparément, prêtes à partager." },
      { property: "og:title", content: "Contre-feu — Synthèse de décision" },
      { property: "og:description", content: "Une synthèse copiable, prête pour la réunion." },
    ],
  }),
  component: Synthese,
});

function Synthese() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  const pm = useUserName();
  const [copied, setCopied] = useState(false);
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  const a = list.find((x) => x.id === id);
  if (!a) return <Missing />;
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const oc = outcome(a);
  const key = a.objections.find((o) => o.id === a.keyObjection);
  const changed = a.decision && a.position && a.decision !== a.position;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="w-full space-y-6 px-6 lg:px-10 py-10">
        <Link to="/" className="no-print text-sm font-bold text-accent no-underline">← Mes analyses</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Synthèse de décision · prête à partager · non éditable</p>
            <h1 className="mt-2 text-5xl text-primary">{titleOf(a)}</h1>
            <p className="mt-2 text-muted-foreground">{KIND[a.kind].name}{pm ? ` · ${pm}` : ""}{a.completedAt ? ` · ${new Date(a.completedAt).toLocaleDateString("fr-FR")}` : ""}</p>
          </div>
          <div className="no-print flex gap-2">
            <Btn variant="outline" onClick={async () => { await navigator.clipboard.writeText(synthesisText(a, pm)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}><Copy className="h-4 w-4" />{copied ? "Copiée" : "Copier la synthèse"}</Btn>
            <Btn variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer</Btn>
          </div>
        </div>
        <Card><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Situation</p><p className="mt-1 text-lg">{a.summary || a.signal || a.observe}</p></Card>
        <div className="grid gap-5 md:grid-cols-2">
          <Card><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Position de départ · révélée</p><p className="mt-1 font-display text-3xl text-primary">{a.position}</p>{a.positionWhy && <p className="mt-1 text-sm">{a.positionWhy}</p>}</Card>
          <Card className="bg-primary text-primary-foreground"><p className="text-xs font-bold uppercase tracking-wider text-highlight">Recommandation de Contre-feu · IA</p><p className="mt-1 font-display text-3xl">{t?.label ?? "—"}</p><p className="text-sm">Confiance {t ? CONF[t.conf] : "—"}{a.aiTrendInitial && a.aiTrendInitial !== t?.label ? ` · proposition initiale : ${a.aiTrendInitial}` : ""}</p></Card>
        </div>
        <Card className="border-2 border-primary">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Décision du PM{pm ? ` · ${pm}` : ""}</p>
          <p className="mt-1 font-display text-4xl text-primary">{a.decision}</p>
          {a.decisionWhy && <p className="mt-2"><strong>Pourquoi :</strong> {a.decisionWhy}</p>}
          {a.position && a.decision && <p className="mt-2 text-sm">{changed ? `${a.position} → ${a.decision} : votre réflexion a évolué.` : "Décision identique à votre position de départ."}</p>}
        </Card>
        {key && <Card><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Objection déterminante · {key.role} · {key.option}</p><p className="mt-1 text-lg">« {key.text} »</p></Card>}
        <Card className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Suite</p>
          <p>Revue : {a.reviewDate ? new Date(a.reviewDate).toLocaleDateString("fr-FR") : "—"}{a.trigger ? ` · signal déclencheur : ${a.trigger}` : ""}</p>
          <p>Mesure : {a.measure}</p>
          {filled(a.risks).length > 0 && <p>Risques déjà identifiés : {filled(a.risks).join(" ; ")}</p>}
        </Card>
        {oc && <Card><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Issue calculée</p><p className="mt-1 font-display text-3xl text-primary">{oc.label}</p><ul className="mt-1 text-sm">{oc.lines.map((l) => <li key={l}>{l}</li>)}</ul></Card>}
        <details className="rounded-3xl border border-border bg-card p-6">
          <summary className="cursor-pointer font-bold">Le raisonnement complet · contexte, arguments de l’IA, objections, évolution</summary>
          <div className="mt-4 space-y-4 text-sm">
            <div><p className="font-bold">Lecture de la situation</p><ul className="list-disc pl-5">{a.reading.map((r) => <li key={r.id}>[{r.status}] {r.text}{r.orig ? " (corrigé)" : ""}</li>)}</ul></div>
            <div><p className="font-bold">Critères</p><ul className="list-disc pl-5">{a.criteria.map((c) => <li key={c.id}>{c.name} : {c.value}{c.motif ? ` (IA : ${c.ai})` : ""}</li>)}</ul></div>
            <div><p className="font-bold">Objections</p><ul className="list-disc pl-5">{a.objections.map((o) => <li key={o.id}>{o.option} · {o.role} : {o.text} {o.useful === "oui" && o.novel === "oui" && <Pill tone="soft">utile et nouvelle</Pill>}</li>)}</ul></div>
          </div>
        </details>
        <p className="text-sm text-muted-foreground">Contre-feu éclaire la décision mais ne décide pas : la recommandation de l’IA et la décision du PM sont présentées séparément et ne se remplacent jamais.</p>
        <Link to="/revue/$id" params={{ id: a.id }} className="no-print inline-flex font-bold text-accent">Faire la revue de décision →</Link>
      </main>
    </div>
  );
}
