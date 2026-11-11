import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppHeader, Btn, Card, Chip, Field, ListEditor, Pill, Required, inputCls } from "@/components/cf/ui";
import {
  KIND_LABEL, OPTIONS, ROBUSTNESS_LABEL, STEPS, STEP_CHECKS, VOICES, optionRobustness, realObjections, reviewDueDate, suggestedOption,
  type Analysis, type Changed, type Confidence, type Objection, type Verdict,
} from "@/lib/analyses";
import { Missing } from "@/components/cf/Missing";
import { saveAnalysis, useAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { runAI } from "@/lib/ai.functions";
import { filled } from "@/lib/analyses";

function useAI(a: Analysis) {
  const fn = useServerFn(runAI);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (task: "lecture" | "objections") => {
    setBusy(true); setErr("");
    try {
      const r = await fn({ data: { task, kind: a.kind, title: a.title, signal: a.signal, startPosition: a.startPosition, options: OPTIONS[a.kind], voices: VOICES[a.kind].map((v) => ({ id: v.id, label: v.label })), known: filled(a.known), assumed: filled(a.assumed) } });
      if (r.error) { setErr(r.error); return null; }
      return JSON.parse(r.result) as Record<string, unknown>;
    } catch { setErr("L’IA n’a pas pu répondre."); return null; } finally { setBusy(false); }
  };
  return { busy, err, run };
}

function AIBar({ label, busy, err, onClick }: { label: string; busy: boolean; err: string; onClick: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn variant="outline" disabled={busy} onClick={onClick}><Sparkles className="h-4 w-4" />{busy ? "Analyse en cours…" : label}</Btn>
      {err && <span className="text-sm font-bold text-destructive">{err}</span>}
    </div>
  );
}
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);

export const Route = createFileRoute("/analyse/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Analyse en cours" },
      { name: "description", content: "Décrire, comprendre, mettre à l’épreuve, évaluer et décider." },
      { property: "og:title", content: "Contre-feu — Analyse en cours" },
      { property: "og:description", content: "Une décision argumentée en 30 minutes." },
    ],
  }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  const a = list?.find((x) => x.id === id);
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  if (!a) return <Missing />;
  return <Workspace key={a.id} a={a} />;
}

const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Workspace({ a }: { a: Analysis }) {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<string[]>([]);
  const [view, setView] = useState(a.completedAt ? 4 : a.step);
  const [elapsed, setElapsed] = useState(a.elapsed ?? 0);
  const up = (patch: Partial<Analysis>) => saveAnalysis({ ...a, ...patch });

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (elapsed % 15 === 0 && elapsed !== (a.elapsed ?? 0)) up({ elapsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  useEffect(() => { setErrors([]); window.scrollTo(0, 0); }, [view]);

  const next = () => {
    const errs = STEP_CHECKS[view]!(a);
    if (errs.length) { setErrors(errs); return; }
    if (view === 4) {
      const now = new Date();
      up({ completedAt: now.toISOString(), reviewDue: reviewDueDate(now), step: 4, elapsed });
      navigate({ to: "/synthese/$id", params: { id: a.id } });
      return;
    }
    up({ step: Math.max(a.step, view + 1), elapsed });
    setView(view + 1);
  };

  const locked = !!a.completedAt;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div>
            <Pill tone={locked ? "success" : "accent"}>{locked ? "Analyse terminée" : "Analyse en cours"}</Pill>
            <h2 className="mt-2 text-2xl text-primary">{a.title || "Nouvelle analyse"}</h2>
            <p className="text-sm text-muted-foreground">{KIND_LABEL[a.kind]}</p>
          </div>
          <div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Temps passé</span><span><strong className="font-mono">{fmtTime(elapsed)}</strong> / 30 min</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"><div className={cn("h-full", elapsed > 1800 ? "bg-accent" : "bg-primary")} style={{ width: `${Math.min(100, (elapsed / 1800) * 100)}%` }} /></div>
          </div>
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const done = i < a.step || locked;
              const reachable = i <= a.step || locked;
              return (
                <li key={s}>
                  <button type="button" disabled={!reachable} onClick={() => setView(i)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left", view === i ? "bg-secondary" : "hover:bg-muted", !reachable && "opacity-50")}>
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold", done ? "bg-success text-success-foreground" : view === i ? "bg-accent text-accent-foreground" : "border-2 border-border")}>
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span><span className="block font-bold">{s}</span><span className="text-xs text-muted-foreground">{done ? "fait" : i === a.step ? "en cours" : "à venir"}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="rounded-2xl bg-muted p-3 text-sm">Enregistré automatiquement dans ce navigateur.</p>
          {!locked && (
            <button type="button" className="text-sm font-bold text-accent" onClick={() => {
              if (window.confirm("Abandonner cette analyse ? Elle restera consultable dans votre liste.")) { up({ abandoned: true }); navigate({ to: "/" }); }
            }}>Abandonner l’analyse</button>
          )}
        </aside>

        <main className="space-y-6">
          {locked && (
            <div className="flex items-center gap-3 rounded-2xl bg-success-soft p-4 text-success">
              <Lock className="h-5 w-5" /> Analyse terminée : lecture seule.
              <Link to="/synthese/$id" params={{ id: a.id }} className="ml-auto font-bold text-success">Voir la synthèse →</Link>
            </div>
          )}
          <fieldset disabled={locked} className="space-y-6">
            {view === 0 && <Describe a={a} up={up} />}
            {view === 1 && <Understand a={a} up={up} />}
            {view === 2 && <Test a={a} up={up} />}
            {view === 3 && <Evaluate a={a} up={up} />}
            {view === 4 && <Decide a={a} up={up} />}
          </fieldset>
          {errors.length > 0 && (
            <div role="alert" className="rounded-2xl border-2 border-accent bg-secondary p-5 text-secondary-foreground">
              <p className="flex items-center gap-2 font-bold"><AlertCircle className="h-5 w-5" /> Avant de continuer :</p>
              <ul className="mt-2 list-disc pl-8">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {!locked && (
            <div className="flex justify-between">
              <Btn variant="outline" disabled={view === 0} onClick={() => setView(view - 1)}><ChevronLeft className="h-4 w-4" /> Étape précédente</Btn>
              <Btn variant={view === 4 ? "accent" : "primary"} onClick={next}>
                {view === 4 ? "Terminer et voir la synthèse" : `Continuer : ${STEPS[view + 1]}`} <ChevronRight className="h-4 w-4" />
              </Btn>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

type StepProps = { a: Analysis; up: (p: Partial<Analysis>) => void };

function StepHead({ tag, title, accent, text }: { tag: string; title: string; accent: string; text: string }) {
  return (
    <div className="rounded-3xl bg-muted p-7">
      <Pill tone="accent">{tag}</Pill>
      <h1 className="mt-3 text-4xl text-primary">{title} <em className="text-accent">{accent}</em> ?</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">{text}</p>
    </div>
  );
}

function Describe({ a, up }: StepProps) {
  return (
    <>
      <StepHead tag="Étape 1 · environ 2 minutes" title="Que s’est-il" accent="passé" text="Décrivez le signal pendant qu’il est frais. Avant toute analyse, notez ce que vous feriez spontanément : c’est la référence qui dira ce que Contre-feu a changé." />
      <Card className="space-y-5">
        <Field label="Titre de l’analyse" required><input className={inputCls} value={a.title} onChange={(e) => up({ title: e.target.value })} placeholder={a.kind === "concurrent" ? "Ex. Concurrent X — alertes permis en bêta" : "Ex. L’export PDF utilisé comme outil de devis"} /></Field>
        <Field label="Racontez le signal" required hint="Quelques phrases suffisent : ce qui a été vu ou entendu."><textarea rows={4} className={inputCls} value={a.signal} onChange={(e) => up({ signal: e.target.value })} /></Field>
        <Field label="Source" hint="Qui l’a dit, où, quand ?"><input className={inputCls} value={a.source} onChange={(e) => up({ source: e.target.value })} placeholder="Ex. Un prospect, lors d’une démo, la semaine dernière" /></Field>
        <label className="flex items-start gap-3 rounded-2xl bg-muted p-4">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={a.anonymised} onChange={(e) => up({ anonymised: e.target.checked })} />
          <span><strong>J’ai anonymisé ma description</strong><Required /><span className="block text-sm text-muted-foreground">Aucun nom de client ni donnée personnelle.</span></span>
        </label>
      </Card>
      <Card className="space-y-5">
        <div>
          <h2 className="text-2xl text-primary">Votre position de départ<Required /></h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Rappelée seulement au moment de décider.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[...OPTIONS[a.kind], "Je ne sais pas encore"].map((o) => <Chip key={o} dashed={o === "Je ne sais pas encore"} on={a.startPosition === o} onClick={() => up({ startPosition: o })}>{o}</Chip>)}
        </div>
        <Field label="Pourquoi, en une phrase" required><input className={inputCls} value={a.startReason} onChange={(e) => up({ startReason: e.target.value })} placeholder="Ex. Signal trop faible, aucun impact client démontré." /></Field>
        <Field group label="Les risques qui vous inquiètent"><ListEditor items={a.risks} onChange={(risks) => up({ risks })} placeholder="Ex. Réaction des clients grands comptes" addLabel="Ajouter un risque" /></Field>
      </Card>
    </>
  );
}

function ConfidenceChips({ value, onChange }: { value: Confidence | undefined; onChange: (c: Confidence) => void }) {
  return <div className="flex flex-wrap gap-2">{(["faible", "moyenne", "forte"] as const).map((c) => <Chip key={c} on={value === c} onClick={() => onChange(c)}>{c.charAt(0).toUpperCase() + c.slice(1)}</Chip>)}</div>;
}

function Understand({ a, up }: StepProps) {
  const ai = useAI(a);
  return (
    <>
      <StepHead tag="Étape 2 · la situation et l’enjeu" title="Que sait-on" accent="vraiment" text="Séparez ce qui est établi de ce que vous supposez. Une décision prise sur des suppositions mérite une confiance plus faible." />
      <AIBar label="Proposer une lecture (IA)" busy={ai.busy} err={ai.err} onClick={async () => {
        const r = await ai.run("lecture"); if (!r) return;
        const merge = (cur: string[], add: string[]) => [...filled(cur), ...add.map((x) => `${x} (IA)`)];
        up({ known: merge(a.known, strs(r["known"])), assumed: merge(a.assumed, strs(r["assumed"])), unknown: merge(a.unknown, strs(r["unknown"])), ...(a.stake.trim() || typeof r["stake"] !== "string" ? {} : { stake: r["stake"] as string }) });
      }} />
      <div className="grid gap-5 md:grid-cols-3">
        {([["known", "Ce qu’on sait", "Un fait vérifié"], ["assumed", "Ce qu’on suppose", "Une hypothèse"], ["unknown", "Ce qu’on ignore", "Une question ouverte"]] as const).map(([k, l, p]) => (
          <Card key={k} className="p-5">
            <h3 className="mb-3 text-xl text-primary">{l}</h3>
            <ListEditor items={a[k]} onChange={(v) => up({ [k]: v })} placeholder={p} />
          </Card>
        ))}
      </div>
      <Card className="space-y-5">
        <Field group label="Confiance dans cette lecture" required><ConfidenceChips value={a.readingConfidence} onChange={(readingConfidence) => up({ readingConfidence })} /></Field>
        <Field label="L’enjeu" required hint="Qu’est-ce qui est menacé ou possible, si le signal se confirme ?"><textarea rows={3} className={inputCls} value={a.stake} onChange={(e) => up({ stake: e.target.value })} /></Field>
        <Field group label="Qui est touché" hint="Segments de clients, équipes, revenus…"><ListEditor items={a.threatened} onChange={(threatened) => up({ threatened })} placeholder="Ex. PME du bâtiment, offre Pro" /></Field>
        <Field group label="Gravité" required>
          <div className="flex flex-wrap gap-2">{([1, 2, 3] as const).map((s) => <Chip key={s} on={a.severity === s} onClick={() => up({ severity: s })}>{["Faible", "Modérée", "Forte"][s - 1]}</Chip>)}</div>
        </Field>
      </Card>
    </>
  );
}

function Test({ a, up }: StepProps) {
  const [opt, setOpt] = useState<string>(OPTIONS[a.kind][0]!);
  const setObjs = (objections: Objection[]) => up({ objections });
  const ai = useAI(a);
  return (
    <>
      <StepHead tag="Étape 3 · le cœur de Contre-feu" title="Qui attaquerait vos" accent="options" text="Pour chaque option, prenez la place de ceux qu’elle touche et écrivez leurs meilleures objections. Soyez sévère : une objection faible ne vous apprend rien." />
      <AIBar label="Proposer des objections (IA)" busy={ai.busy} err={ai.err} onClick={async () => {
        const r = await ai.run("objections"); if (!r || !Array.isArray(r["objections"])) return;
        const voices = VOICES[a.kind].map((v) => v.id) as string[];
        const add: Objection[] = (r["objections"] as { option?: string; voice?: string; text?: string; support?: string; premise?: string }[]).filter((o) => OPTIONS[a.kind].includes(o.option ?? "") && voices.includes(o.voice ?? "") && o.text).map((o) => ({ id: crypto.randomUUID(), option: o.option!, voice: o.voice as Objection["voice"], text: o.text!, origin: "ia", support: (["etayee", "reformulee", "non"].includes(o.support ?? "") ? o.support : "non") as Objection["support"], premise: o.premise }));
        setObjs([...a.objections, ...add]);
      }} />
      <div className="flex flex-wrap gap-2">
        {OPTIONS[a.kind].map((o) => {
          const n = realObjections(a).filter((x) => x.option === o).length;
          return <Chip key={o} on={opt === o} onClick={() => setOpt(o)}>{o} · {n}</Chip>;
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {VOICES[a.kind].map((v) => {
          const objs = a.objections.filter((o) => o.option === opt && o.voice === v.id);
          return (
            <Card key={v.id} className="space-y-3 p-5">
              <div><h3 className="text-xl text-primary">{v.label}</h3><p className="text-sm text-muted-foreground">{v.hint}</p></div>
              {objs.map((o) => (
                <div key={o.id} className="space-y-1">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Pill tone={o.origin === "ia" ? "primary" : "soft"}>{o.origin === "ia" ? "Analyse de l’IA" : "Votre saisie"}</Pill>
                  {o.support && <Pill tone={o.support === "etayee" ? "success" : o.support === "reformulee" ? "accent" : "muted"}>{{ etayee: "Étayée", reformulee: "Reformulée", non: "Non étayée" }[o.support]}</Pill>}
                </div>
                {o.premise && <p className="text-xs text-muted-foreground">Prémisse : {o.premise}</p>}
                <div className="flex gap-2">
                  <textarea rows={2} className={inputCls} value={o.text} placeholder="Son objection…" onChange={(e) => setObjs(a.objections.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
                  <button type="button" aria-label="Retirer l’objection" className="self-start rounded-full p-2 text-muted-foreground hover:bg-muted" onClick={() => setObjs(a.objections.filter((x) => x.id !== o.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
                </div>
              ))}
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-bold text-accent" onClick={() => setObjs([...a.objections, { id: crypto.randomUUID(), option: opt, voice: v.id, text: "" }])}>
                <Plus className="h-4 w-4" /> Ajouter une objection
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
}

const VERDICTS: { id: Verdict; label: string }[] = [
  { id: "ecartee", label: "Écartée" },
  { id: "a_traiter", label: "À traiter" },
  { id: "bloquante", label: "Bloquante" },
];

function Evaluate({ a, up }: StepProps) {
  const setObj = (id: string, p: Partial<Objection>) => up({ objections: a.objections.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const voiceLabel = (id: string) => VOICES[a.kind].find((v) => v.id === id)?.label;
  return (
    <>
      <StepHead tag="Étape 4 · évaluation" title="Que valent ces" accent="objections" text="Écartée : vous avez une réponse solide. À traiter : elle oblige à ajuster l’option. Bloquante : l’option ne tient pas tant qu’elle existe." />
      {OPTIONS[a.kind].map((o) => {
        const objs = realObjections(a).filter((x) => x.option === o);
        const r = optionRobustness(a, o);
        return (
          <Card key={o} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl text-primary">{o}</h2>
              {r && <Pill tone={r === "solide" ? "success" : r === "ajustements" ? "accent" : "primary"}>{ROBUSTNESS_LABEL[r]}</Pill>}
            </div>
            {objs.map((x) => (
              <div key={x.id} className="space-y-3 rounded-2xl bg-muted p-4">
                <p><span className="text-sm font-bold text-muted-foreground">{voiceLabel(x.voice)} — </span>{x.text}</p>
                <div className="flex flex-wrap gap-2">{VERDICTS.map((v) => <Chip key={v.id} on={x.verdict === v.id} onClick={() => setObj(x.id, { verdict: v.id })}>{v.label}</Chip>)}</div>
                <input className={inputCls} value={x.answer ?? ""} onChange={(e) => setObj(x.id, { answer: e.target.value })} placeholder="Votre réponse ou l’ajustement nécessaire (facultatif)" />
              </div>
            ))}
          </Card>
        );
      })}
      <Card className="space-y-5">
        <h2 className="text-2xl text-primary">Deux questions avant de décider</h2>
        <Field group label="L’épreuve a-t-elle changé votre avis ?" required>
          <div className="flex flex-wrap gap-2">{([["oui", "Oui"], ["en_partie", "En partie"], ["non", "Non"]] as [Changed, string][]).map(([k, l]) => <Chip key={k} on={a.changedMind === k} onClick={() => up({ changedMind: k })}>{l}</Chip>)}</div>
        </Field>
        <Field group label="Quelle confiance dans la décision que vous allez prendre ?" required><ConfidenceChips value={a.decisionConfidence} onChange={(decisionConfidence) => up({ decisionConfidence })} /></Field>
      </Card>
    </>
  );
}

function Decide({ a, up }: StepProps) {
  const sug = suggestedOption(a);
  return (
    <>
      <StepHead tag="Étape 5 · décision" title="Que" accent="décidez-vous" text="Comparez ce que l’épreuve a montré avec votre position de départ, puis tranchez." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-muted">
          <p className="text-sm font-bold text-muted-foreground">Votre position de départ</p>
          <p className="mt-1 font-display text-3xl text-primary">{a.startPosition || "—"}</p>
          <p className="mt-2 italic text-muted-foreground">« {a.startReason} »</p>
        </Card>
        <Card className="bg-success-soft">
          <p className="text-sm font-bold text-success">L’option qui résiste le mieux</p>
          <p className="mt-1 font-display text-3xl text-primary">{sug ?? "—"}</p>
          {sug && <p className="mt-2 text-success">{ROBUSTNESS_LABEL[optionRobustness(a, sug)!]}</p>}
        </Card>
      </div>
      <Card className="space-y-5">
        <Field group label="Votre décision" required>
          <div className="flex flex-wrap gap-2">{OPTIONS[a.kind].map((o) => <Chip key={o} on={a.decision === o} onClick={() => up({ decision: o })}>{o}</Chip>)}</div>
        </Field>
        <Field label="Pourquoi" required hint="Cette justification apparaîtra dans la synthèse."><textarea rows={3} className={inputCls} value={a.decisionReason} onChange={(e) => up({ decisionReason: e.target.value })} /></Field>
        <Field group label="Prochaines actions"><ListEditor items={a.nextSteps} onChange={(nextSteps) => up({ nextSteps })} placeholder="Ex. Appeler trois clients grands comptes d’ici vendredi" addLabel="Ajouter une action" /></Field>
      </Card>
    </>
  );
}
