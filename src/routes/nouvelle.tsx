import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Repeat } from "lucide-react";
import { AppHeader, Card } from "@/components/cf/ui";
import { KIND_LABEL, OPTIONS, newAnalysis, type Kind } from "@/lib/analyses";
import { saveAnalysis } from "@/lib/store";

export const Route = createFileRoute("/nouvelle")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Nouvelle analyse" },
      { name: "description", content: "Décrivez un mouvement concurrent ou un détournement d’usage et mettez vos options à l’épreuve." },
      { property: "og:title", content: "Contre-feu — Nouvelle analyse" },
      { property: "og:description", content: "Choisissez le type de situation et lancez l’analyse." },
    ],
  }),
  component: NewAnalysis,
});

const DESC: Record<Kind, { text: string; Icon: typeof Activity; tone: string }> = {
  concurrent: { text: "Une fonctionnalité, une offre ou un prix nouveau chez un concurrent.", Icon: Activity, tone: "bg-accent text-accent-foreground" },
  detournement: { text: "Une fonctionnalité de votre produit utilisée autrement que prévu.", Icon: Repeat, tone: "bg-success text-success-foreground" },
};

function NewAnalysis() {
  const navigate = useNavigate();
  const start = (kind: Kind) => {
    const a = newAnalysis(kind, crypto.randomUUID(), new Date());
    saveAnalysis(a);
    navigate({ to: "/analyse/$id", params: { id: a.id } });
  };
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
        <div>
          <h1 className="text-5xl text-primary">Quelle <em className="text-accent">situation</em> ?</h1>
          <p className="mt-3 text-lg text-muted-foreground">Vous choisissez : Contre-feu ne devine pas le type de situation.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {(Object.keys(DESC) as Kind[]).map((k) => {
            const { text, Icon, tone } = DESC[k];
            return (
              <button key={k} type="button" onClick={() => start(k)} className="text-left">
                <Card className="h-full border-2 transition hover:-translate-y-1 hover:border-primary">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></span>
                  <h2 className="mt-5 text-3xl text-primary">{KIND_LABEL[k]}</h2>
                  <p className="mt-2 text-muted-foreground">{text}</p>
                  <p className="mt-4 text-sm font-bold text-accent">{OPTIONS[k].join(" · ").toLowerCase()}</p>
                </Card>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
