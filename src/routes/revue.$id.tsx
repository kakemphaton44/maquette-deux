import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader, Btn, Card, Chip, Required, RequiredLegend, choiceInvalidCls, inputCls } from "@/components/cf/ui";
import { Missing } from "@/components/cf/Missing";
import { titleOf, type ReviewHolds, type YesNo } from "@/lib/analyses";
import { saveAnalysis, useAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revue/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Revue de décision" },
      { name: "description", content: "Deux questions, quelques semaines après la décision : a-t-elle tenu ?" },
      { property: "og:title", content: "Contre-feu — Revue de décision" },
      { property: "og:description", content: "La revue alimente le bilan de vos décisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Revue,
});

function Revue() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  const navigate = useNavigate();
  const [holds, setHolds] = useState<ReviewHolds | undefined>();
  const [verified, setVerified] = useState<YesNo | "na" | undefined>();
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  const a = list.find((x) => x.id === id);
  if (!a) return <Missing />;
  const key = a.objections.find((o) => o.id === a.keyObjection);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="w-full space-y-6 px-6 lg:px-10 py-10">
        <Link to="/" className="text-sm font-bold text-accent no-underline">← Mes analyses</Link>
        <div><p className="text-xs font-bold uppercase tracking-wider text-accent">Revue de décision</p><h1 className="mt-2 text-5xl text-primary">{titleOf(a)}</h1>
          <p className="mt-2 text-muted-foreground">Deux questions, quelques semaines après la décision. Elles disent si l’analyse vous avait bien préparé, et alimentent le bilan de vos revues.</p></div>
        {a.review && <p className="rounded-2xl bg-success-soft px-5 py-3 font-bold text-success">✓ Revue enregistrée le {new Date(a.review.date).toLocaleDateString("fr-FR")}.</p>}
        <Card className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Votre décision</p><p className="font-display text-3xl text-primary">{a.decision ?? "—"}</p>{a.decisionWhy && <p>{a.decisionWhy}</p>}
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">L’objection que vous aviez marquée décisive</p>
          {key ? <p>{key.role} : « {key.text} »</p> : <p className="text-muted-foreground">Aucune objection n’avait été désignée.</p>}
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ce que vous deviez surveiller</p><p>{[a.trigger, a.measure].filter(Boolean).join(" · ") || "—"}</p>
        </Card>
        <Card className="space-y-5">
          <RequiredLegend />
          <div className="space-y-2"><p className="font-bold">La décision tient-elle toujours ?<Required kind="choice" /></p>
            <div role="group" aria-label="La décision tient-elle toujours ?" aria-required="true" aria-invalid={err || undefined} className={cn("flex flex-wrap gap-2", err && choiceInvalidCls)}>{([["oui", "Oui"], ["en_partie", "En partie"], ["non", "Non"]] as const).map(([v, l]) => <Chip key={v} on={holds === v} onClick={() => { setHolds(v); setErr(false); }}>{l}</Chip>)}</div>
            {err && <p className="text-sm font-bold text-destructive">Choisissez une réponse pour enregistrer la revue.</p>}</div>
          <div className="space-y-2"><p className="font-bold">L’objection décisive s’est-elle vérifiée ? · facultatif</p>
            <div className="flex flex-wrap gap-2">{([["oui", "Oui"], ["non", "Non"], ["na", "Pas encore"]] as const).map(([v, l]) => <Chip key={v} on={verified === v} onClick={() => setVerified(v)}>{l}</Chip>)}</div></div>
          <label className="block space-y-2"><span className="font-bold">Ce qui s’est passé depuis · facultatif</span><span className="block text-sm text-muted-foreground">Sans nom de client ni donnée personnelle.</span><textarea rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <Btn variant="accent" aria-disabled={!holds || undefined} onClick={() => { if (!holds) return setErr(true); saveAnalysis({ ...a, review: { holds, verified, note, date: new Date().toISOString() } }); navigate({ to: "/" }); }}>Enregistrer la revue</Btn>
        </Card>
      </main>
    </div>
  );
}
