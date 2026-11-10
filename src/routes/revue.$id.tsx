import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Missing } from "@/components/cf/Missing";
import { AppHeader, Btn, Card, Chip, Field, inputCls } from "@/components/cf/ui";
import { type Analysis, type ReviewOutcome } from "@/lib/analyses";
import { saveAnalysis, useAnalyses } from "@/lib/store";

export const Route = createFileRoute("/revue/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Revue de décision" },
      { name: "description", content: "Votre décision a-t-elle tenu ? Notez-le pour apprendre de vos décisions passées." },
      { property: "og:title", content: "Contre-feu — Revue de décision" },
      { property: "og:description", content: "Revenez sur une décision passée." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  const a = list?.find((x) => x.id === id);
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  if (!a || !a.completedAt) return <Missing />;
  return <Review a={a} />;
}

function Review({ a }: { a: Analysis }) {
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<ReviewOutcome | undefined>(a.review?.outcome);
  const [note, setNote] = useState(a.review?.note ?? "");
  const [err, setErr] = useState(false);
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <Link to="/synthese/$id" params={{ id: a.id }} className="font-bold text-accent">← Synthèse</Link>
        <h1 className="text-5xl text-primary">La décision a-t-elle <em className="text-accent">tenu</em> ?</h1>
        <Card className="bg-muted">
          <p className="text-sm text-muted-foreground">{a.title} · décidé le {new Date(a.completedAt!).toLocaleDateString("fr-FR")}</p>
          <p className="mt-1 font-display text-3xl text-primary">{a.decision}</p>
          <p className="mt-2 italic">« {a.decisionReason} »</p>
        </Card>
        <Card className="space-y-5">
          <Field group label="Avec le recul">
            <div className="flex flex-wrap gap-2">
              {([["tenu", "Elle a tenu telle quelle"], ["partiel", "Elle n’a tenu qu’en partie"], ["pas_tenu", "Elle n’a pas tenu"]] as [ReviewOutcome, string][]).map(([k, l]) => <Chip key={k} on={outcome === k} onClick={() => setOutcome(k)}>{l}</Chip>)}
            </div>
          </Field>
          <Field label="Ce que vous en retenez"><textarea rows={4} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. L’objection des clients grands comptes était juste : à surveiller plus tôt." /></Field>
          {err && <p role="alert" className="font-bold text-destructive">Choisissez une réponse.</p>}
          <Btn onClick={() => {
            if (!outcome) { setErr(true); return; }
            saveAnalysis({ ...a, review: { outcome, note, date: new Date().toISOString() } });
            navigate({ to: "/" });
          }}>Enregistrer la revue</Btn>
        </Card>
      </main>
    </div>
  );
}
