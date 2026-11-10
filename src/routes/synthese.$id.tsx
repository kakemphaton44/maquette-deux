import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Printer } from "lucide-react";
import { Missing } from "@/components/cf/Missing";
import { AppHeader, Btn, Card, Pill } from "@/components/cf/ui";
import { KIND_LABEL, OPTIONS, ROBUSTNESS_LABEL, VOICES, filled, optionRobustness, realObjections, status, STATUS_LABEL, type Analysis } from "@/lib/analyses";
import { useAnalyses, useUserName } from "@/lib/store";

export const Route = createFileRoute("/synthese/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Synthèse de décision" },
      { name: "description", content: "La décision, les objections qui l’ont éprouvée et les prochaines actions, prête pour la réunion." },
      { property: "og:title", content: "Contre-feu — Synthèse de décision" },
      { property: "og:description", content: "Une synthèse à partager en réunion." },
    ],
  }),
  component: Page,
});

const CONF = { faible: "faible", moyenne: "moyenne", forte: "forte" };
const CHANGED = { oui: "Oui", en_partie: "En partie", non: "Non" };
const VERDICT = { ecartee: "Écartée", a_traiter: "À traiter", bloquante: "Bloquante" };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");

function Page() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  const a = list?.find((x) => x.id === id);
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  if (!a) return <Missing />;
  return <Synthese a={a} />;
}

function Synthese({ a }: { a: Analysis }) {
  const name = useUserName();
  const s = status(a, new Date());
  const changed = a.startPosition && a.decision && a.startPosition !== a.decision;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="no-print flex flex-wrap items-center gap-3">
          <Link to="/" className="font-bold text-accent">← Mes analyses</Link>
          <div className="ml-auto flex gap-2">
            <Link to="/analyse/$id" params={{ id: a.id }} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-border bg-card px-5 font-bold text-foreground no-underline"><Pencil className="h-4 w-4" /> {a.completedAt ? "Voir le parcours" : "Reprendre"}</Link>
            {(s === "terminee" || s === "revue_a_faire") && <Link to="/revue/$id" params={{ id: a.id }} className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-5 font-bold text-foreground no-underline">Faire la revue</Link>}
            <Btn onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer / PDF</Btn>
          </div>
        </div>

        <section className="rounded-[2rem] bg-primary p-10 text-primary-foreground">
          <div className="flex flex-wrap gap-2"><Pill tone="primary">{KIND_LABEL[a.kind]}</Pill><Pill tone="muted">{STATUS_LABEL[s]}</Pill></div>
          <h1 className="mt-4 text-5xl">{a.title}</h1>
          <p className="mt-2 text-primary-foreground/70">{name ? `${name} · ` : ""}{fmt(a.completedAt ?? a.updatedAt)} · {Math.round((a.elapsed ?? 0) / 60)} min d’analyse</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div><p className="text-sm text-primary-foreground/60">Position de départ</p><p className="font-display text-3xl">{a.startPosition || "—"}</p></div>
            <div><p className="text-sm text-primary-foreground/60">Décision</p><p className="font-display text-3xl text-highlight">{a.decision || "—"}</p></div>
            <div><p className="text-sm text-primary-foreground/60">Confiance</p><p className="font-display text-3xl">{a.decisionConfidence ? CONF[a.decisionConfidence] : "—"}</p></div>
          </div>
          {a.decision && <p className="mt-6 rounded-2xl bg-primary-foreground/10 p-4">{changed ? `L’épreuve a fait évoluer la position : de « ${a.startPosition} » à « ${a.decision} ».` : "La décision confirme la position de départ."} Avis changé : {a.changedMind ? CHANGED[a.changedMind] : "—"}.</p>}
        </section>

        <Card><h2 className="text-2xl text-primary">Pourquoi</h2><p className="mt-2 whitespace-pre-wrap text-lg">{a.decisionReason || "—"}</p>
          {filled(a.nextSteps).length > 0 && <><h3 className="mt-6 text-xl text-primary">Prochaines actions</h3><ul className="mt-2 list-disc space-y-1 pl-6">{filled(a.nextSteps).map((x) => <li key={x}>{x}</li>)}</ul></>}
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card><h2 className="text-2xl text-primary">Le signal</h2><p className="mt-2 whitespace-pre-wrap">{a.signal}</p>{a.source && <p className="mt-2 text-sm text-muted-foreground">Source : {a.source}</p>}</Card>
          <Card><h2 className="text-2xl text-primary">L’enjeu</h2><p className="mt-2 whitespace-pre-wrap">{a.stake || "—"}</p>
            <p className="mt-3 text-sm text-muted-foreground">Gravité : {a.severity ? ["faible", "modérée", "forte"][a.severity - 1] : "—"} · Lecture de confiance {a.readingConfidence ? CONF[a.readingConfidence] : "—"}</p>
            {filled(a.threatened).length > 0 && <p className="mt-1 text-sm text-muted-foreground">Touchés : {filled(a.threatened).join(", ")}</p>}
          </Card>
        </div>

        <Card>
          <h2 className="text-2xl text-primary">Ce qu’on sait, suppose, ignore</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {([["Sait", a.known], ["Suppose", a.assumed], ["Ignore", a.unknown]] as const).map(([l, xs]) => (
              <div key={l}><p className="font-bold">{l}</p><ul className="mt-1 list-disc pl-5 text-sm">{filled(xs).map((x) => <li key={x}>{x}</li>)}{!filled(xs).length && <li className="text-muted-foreground">—</li>}</ul></div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-2xl text-primary">Les options face aux objections</h2>
          {OPTIONS[a.kind].map((o) => {
            const r = optionRobustness(a, o);
            const objs = realObjections(a).filter((x) => x.option === o);
            return (
              <div key={o} className={`rounded-2xl p-5 ${o === a.decision ? "border-2 border-primary" : "bg-muted"}`}>
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl text-primary">{o}</h3>{o === a.decision && <Pill tone="primary">Décision</Pill>}{r && <Pill tone={r === "solide" ? "success" : "accent"}>{ROBUSTNESS_LABEL[r]}</Pill>}</div>
                <ul className="mt-3 space-y-2 text-sm">
                  {objs.map((x) => (
                    <li key={x.id}><strong>{VOICES[a.kind].find((v) => v.id === x.voice)?.label}</strong> — {x.text} {x.verdict && <em className="text-muted-foreground">({VERDICT[x.verdict]}{x.answer ? ` : ${x.answer}` : ""})</em>}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>

        {a.review && (
          <Card className="bg-success-soft">
            <h2 className="text-2xl text-primary">Revue du {fmt(a.review.date)}</h2>
            <p className="mt-2 font-bold">{{ tenu: "La décision a tenu telle quelle", partiel: "La décision n’a tenu qu’en partie", pas_tenu: "La décision n’a pas tenu" }[a.review.outcome]}</p>
            {a.review.note && <p className="mt-1 whitespace-pre-wrap">{a.review.note}</p>}
          </Card>
        )}
      </main>
    </div>
  );
}
