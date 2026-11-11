import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Lock, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppHeader, Btn, Card, Chip, Field, ListEditor, Pill, inputCls } from "@/components/cf/ui";
import { Missing } from "@/components/cf/Missing";
import { runAI } from "@/lib/ai.functions";
import {
  CONF, CRITERIA, KIND, MOTIF_LABEL, NSP, READ_LABEL, STATUS, STEPS, SUPPORT_LABEL,
  closeErrors, decideErrors, describeErrors, evalStats, filled, outcome, scaleMax, solidity, status, titleOf, trend,
  type Analysis, type Criterion, type Motif, type Objection, type ReadStatus, type ReadingItem, type Support, type YesNo,
} from "@/lib/analyses";
import { getAnalysis, saveAnalysis, useAnalyses } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analyse/$id")({
  head: () => ({
    meta: [
      { title: "Contre-feu — Analyse" },
      { name: "description", content: "Décrire, comprendre, mettre à l’épreuve et décider, avec Contre-feu." },
      { property: "og:title", content: "Contre-feu — Analyse" },
      { property: "og:description", content: "L’IA lit la situation et attaque vos options ; vous décidez." },
    ],
  }),
  component: AnalysisPage,
});

type Up = (p: Partial<Analysis>) => void;
const uid = () => crypto.randomUUID();

function AnalysisPage() {
  const { id } = Route.useParams();
  const list = useAnalyses();
  if (!list) return <div className="min-h-screen"><AppHeader /></div>;
  const a = list.find((x) => x.id === id);
  if (!a) return <Missing />;
  return <Workspace a={a} />;
}

/* ———————————— IA ———————————— */
function useAI(a: Analysis, up: Up) {
  const fn = useServerFn(runAI);
  const [busy, setBusy] = useState<string>("");
  const [err, setErr] = useState("");
  const call = async (task: "lecture" | "enjeu" | "objections", cur: Analysis) => {
    setBusy(task); setErr("");
    try {
      const r = await fn({ data: {
        task, kind: cur.kind, signal: cur.signal, prevu: cur.prevu, observe: cur.observe, contexte: cur.contexte,
        options: KIND[cur.kind].options, roles: KIND[cur.kind].roles, criteria: CRITERIA[cur.kind].map((c) => ({ id: c.id, name: c.name })),
        reading: cur.reading.map((i) => ({ status: i.status, text: i.text })), scores: cur.criteria.map((c) => ({ name: c.name, value: c.value })),
      } });
      if (r.error) throw new Error(r.error);
      return JSON.parse(r.result) as Record<string, unknown>;
    } catch (e) {
      const m = e instanceof Error && e.message ? e.message : "Le service IA n’a pas répondu.";
      setErr(m); up({ techFail: m });
      return null;
    } finally { setBusy(""); }
  };
  const parseCriteria = (cur: Analysis, raw: unknown): Criterion[] => {
    const arr = Array.isArray(raw) ? (raw as { id?: string; value?: number; why?: string }[]) : [];
    const max = scaleMax(cur.kind);
    return CRITERIA[cur.kind].map((d) => {
      const f = arr.find((x) => x.id === d.id);
      const ai = Math.min(max, Math.max(1, Math.round(Number(f?.value) || 1)));
      const prev = cur.criteria.find((c) => c.id === d.id);
      return { id: d.id, name: d.name, cat: d.cat, ai, value: prev?.motif ? prev.value : ai, why: String(f?.why ?? ""), motif: prev?.motif, note: prev?.note };
    });
  };
  const lecture = async (cur: Analysis) => {
    const r = await call("lecture", cur); if (!r) return;
    const items = (Array.isArray(r["items"]) ? r["items"] : []) as Record<string, string>[];
    const reading: ReadingItem[] = items.map((i) => ({ id: uid(), label: String(i["label"] ?? ""), status: (["sait", "suppose", "ignore"].includes(i["status"] ?? "") ? i["status"] : "ignore") as ReadStatus, text: String(i["text"] ?? ""), source: String(i["source"] ?? ""), quote: i["quote"] || undefined }));
    const criteria = parseCriteria({ ...cur, criteria: [] }, r["criteria"]);
    const blocking = cur.kind === "detournement" && r["blocking"] === true;
    const t = trend(cur.kind, criteria, reading, blocking, true);
    up({ launched: true, step: 1, summary: String(r["summary"] ?? ""), reading, criteria, blocking, aiTrendInitial: t?.label, staleEnjeu: false, staleObjections: false, objections: [], techFail: undefined });
  };
  const enjeu = async (cur: Analysis) => {
    const r = await call("enjeu", cur); if (!r) return;
    up({ criteria: parseCriteria(cur, r["criteria"]), ...(cur.kind === "detournement" ? { blocking: r["blocking"] === true } : {}), staleEnjeu: false, staleObjections: cur.objections.length > 0, techFail: undefined });
  };
  const objections = async (cur: Analysis) => {
    const r = await call("objections", cur); if (!r) return;
    const K = KIND[cur.kind];
    const raw = (Array.isArray(r["objections"]) ? r["objections"] : []) as { option?: string; role?: string; text?: string; support?: string; initial?: string; premises?: { status?: string; text?: string; src?: string }[] }[];
    const objs: Objection[] = raw.filter((o) => K.options.includes(o.option ?? "") && o.text).map((o) => ({
      id: uid(), option: o.option!, role: K.roles.includes(o.role ?? "") ? o.role! : (o.role ?? ""), text: o.text!,
      support: (["etayee", "reformulee", "non"].includes(o.support ?? "") ? o.support : "non") as Support, initial: o.initial || undefined,
      premises: (o.premises ?? []).filter((p) => p.text).map((p) => ({ status: (["sait", "suppose", "ignore"].includes(p.status ?? "") ? p.status : "suppose") as ReadStatus, text: p.text!, src: p.src ?? "" })),
    }));
    up({ objections: objs, staleObjections: false, keyObjection: undefined, techFail: undefined });
  };
  return { busy, err, lecture, enjeu, objections };
}

/* ———————————— Cadre ———————————— */
function Workspace({ a }: { a: Analysis }) {
  const navigate = useNavigate();
  const up: Up = (p) => saveAnalysis({ ...(getAnalysis(a.id) ?? a), ...p });
  const ai = useAI(a, up);
  const st = status(a);
  const readOnly = st === "evaluee" || st === "abandonnee";
  const [view, setView] = useState(a.step);
  useEffect(() => setView(a.step), [a.step]);
  const [tried, setTried] = useState(false);
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);

  const goStep = (n: number) => { up({ step: Math.max(a.step, n) }); setView(n); setTried(false); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="grid w-full gap-8 px-6 lg:px-10 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="no-print space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Link to="/" className="text-sm font-bold text-accent no-underline">← Mes analyses</Link>
          <div>
            <h2 className="text-2xl leading-tight text-primary">{titleOf(a)}</h2>
            <div className="mt-2 flex flex-wrap gap-2"><Pill tone="accent">{STATUS[st].glyph} {STATUS[st].label}</Pill><Pill>{KIND[a.kind].code}</Pill></div>
          </div>
          <nav aria-label="Parcours" className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parcours</p>
            {STEPS.map((s, i) => {
              const reach = i <= a.step;
              return (
                <button key={s.label} type="button" disabled={!reach} onClick={() => setView(i)}
                  className={cn("flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left", view === i ? "bg-primary text-primary-foreground" : reach ? "hover:bg-muted" : "opacity-50")}>
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs", view === i ? "bg-highlight text-primary" : i < a.step ? "bg-success text-success-foreground" : "bg-muted")}>
                    {i < a.step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span><span className="block font-bold">{s.label}</span><span className="block text-xs opacity-75">{s.sub}</span></span>
                </button>
              );
            })}
          </nav>
          {a.position && (
            <Card className="p-4">
              {a.step >= 3 ? (
                <><p className="text-xs font-bold uppercase tracking-wider text-accent">Position de départ · révélée</p><p className="mt-1 font-display text-xl text-primary">{a.position}</p></>
              ) : (
                <><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Position de départ</p><p className="mt-1 text-sm">Enregistrée · masquée. Révélée à l’étape « Décider ».</p></>
              )}
            </Card>
          )}
          {!readOnly && a.launched && (
            <button type="button" className="text-sm font-bold text-destructive" onClick={() => { if (window.confirm("Abandonner cette analyse ? Elle sera close sans issue, en consultation seule.")) { up({ abandoned: true }); navigate({ to: "/" }); } }}>
              Abandonner cette analyse
            </button>
          )}
        </aside>

        <div className="min-w-0 space-y-6">
          {readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted px-5 py-3 text-sm">
              <span><strong>{STATUS[st].glyph} Consultation seule · {STATUS[st].label}</strong> — {STATUS[st].def}</span>
              {st === "evaluee" && <Link to="/synthese/$id" params={{ id: a.id }} className="font-bold text-accent">Voir la synthèse →</Link>}
            </div>
          )}
          {view < a.step && !readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-soft px-5 py-3 text-sm text-success">
              <span>Consultation d’une étape précédente. Étape en cours : <strong>{STEPS[a.step]!.label}</strong>.</span>
              <button type="button" className="font-bold underline" onClick={() => setView(a.step)}>Revenir à l’étape en cours</button>
            </div>
          )}
          {a.techFail && !ai.busy && (
            <Card className="border-2 border-destructive/40">
              <p className="flex items-center gap-2 font-bold text-destructive"><AlertCircle className="h-5 w-5" /> Échec technique · analyse bloquée</p>
              <p className="mt-1 text-sm">{a.techFail} Aucun résultat partiel n’a été conservé ni affiché. Toutes vos saisies sont conservées ; votre position de départ reste masquée.</p>
            </Card>
          )}
          {ai.busy && <Working task={ai.busy} />}

          <fieldset disabled={readOnly || !!ai.busy} className="min-w-0 space-y-6">
            {view === 0 && <Describe a={a} up={up} tried={tried} locked={a.launched} />}
            {view === 1 && <Understand a={a} up={up} onEnjeu={() => ai.enjeu(a)} />}
            {view === 2 && <Test a={a} up={up} onRegen={() => ai.objections(a)} />}
            {view === 3 && <Decide a={a} up={up} trendLabel={t?.label ?? null} tried={tried} />}
          </fieldset>

          {!readOnly && view === a.step && (
            <BottomBar
              prev={view > 0 ? () => setView(view - 1) : undefined}
              prevLabel={view > 0 ? STEPS[view - 1]!.label : ""}
              primary={
                view === 0 ? { label: a.launched ? "Continuer" : "Lancer l’analyse", run: () => { if (a.launched) return goStep(1); setTried(true); if (!describeErrors(a).length) ai.lecture(a); } }
                : view === 1 ? { label: a.objections.length ? "Continuer" : "Mettre les options à l’épreuve", disabled: a.staleEnjeu, run: async () => { if (!a.objections.length) await ai.objections(a); goStep(2); } }
                : view === 2 ? { label: "Décider", disabled: a.staleObjections || !a.objections.length, run: () => goStep(3) }
                : { label: "Clore l’analyse", run: () => {
                    setTried(true);
                    if (decideErrors(a, t?.label ?? null).length || closeErrors(a).length) return;
                    up({ completedAt: new Date().toISOString() }); navigate({ to: "/synthese/$id", params: { id: a.id } });
                  } }
              }
              note={view === 1 && a.staleEnjeu ? "Regénérez l’évaluation pour continuer." : view === 2 && a.staleObjections ? "Regénérez les objections pour continuer." : view === 3 ? "Vous pouvez quitter : l’analyse reste reprenable depuis « Mes analyses »." : ""}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Working({ task }: { task: string }) {
  const label = { lecture: "Lecture de la situation", enjeu: "Évaluation de l’enjeu", objections: "Mise à l’épreuve des options" }[task] ?? "Analyse";
  return (
    <Card className="flex items-center gap-4 bg-primary text-primary-foreground">
      <span className="h-8 w-8 rounded-full border-4 border-primary-foreground/30 border-t-highlight" style={{ animation: "cf-spin 1s linear infinite" }} />
      <div><p className="text-xs font-bold uppercase tracking-wider text-highlight">Contre-feu travaille</p><p className="font-display text-2xl">{label}…</p><p className="text-sm text-primary-foreground/70">Votre position de départ reste masquée. Aucun résultat partiel ne sera affiché comme complet.</p></div>
    </Card>
  );
}

function BottomBar({ prev, prevLabel, primary, note }: { prev?: (() => void) | undefined; prevLabel: string; primary: { label: string; run: () => void; disabled?: boolean }; note: string }) {
  return (
    <div className="no-print sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-full border border-border bg-card px-4 py-3 shadow-soft">
      {prev ? <Btn variant="ghost" onClick={prev}><ChevronLeft className="h-4 w-4" /> {prevLabel}</Btn> : <span />}
      <span className="flex-1 text-sm text-muted-foreground">{note}</span>
      <Btn variant="accent" disabled={primary.disabled} onClick={primary.run}>{primary.label} <ChevronRight className="h-4 w-4" /></Btn>
    </div>
  );
}

function Head({ tag, title, lead }: { tag: string; title: ReactNode; lead: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-accent">{tag}</p>
      <h1 className="mt-2 text-5xl leading-[1.05] text-primary">{title}</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{lead}</p>
    </div>
  );
}
const AIBadge = () => <Pill tone="primary"><Sparkles className="mr-1 h-3 w-3" /> Analyse de l’IA</Pill>;
const YouBadge = () => <Pill tone="soft">Votre saisie</Pill>;

/* ———————————— 1. Décrire ———————————— */
function Describe({ a, up, tried, locked }: { a: Analysis; up: Up; tried: boolean; locked: boolean }) {
  const K = KIND[a.kind];
  const errs = tried ? describeErrors(a) : [];
  return (
    <>
      <Head tag={`Étape 1 · ${K.name}`} title={<>Décrire la <em className="text-accent">situation</em></>} lead="Décrivez la situation et votre position spontanée. Votre position sera enregistrée puis masquée pendant toute l’analyse : elle ne sera révélée qu’à la synthèse." />
      {locked && <p className="rounded-2xl bg-muted px-5 py-3 text-sm">L’analyse est lancée : la description n’est plus modifiable.</p>}
      {errs.length > 0 && (
        <Card className="border-2 border-destructive/40">
          <p className="font-bold text-destructive">! Impossible de lancer l’analyse — {errs.length} élément{errs.length > 1 ? "s" : ""} manquant{errs.length > 1 ? "s" : ""}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{errs.map((e) => <li key={e}>{e}</li>)}</ul>
        </Card>
      )}
      <fieldset disabled={locked} className="space-y-6">
        <Card className="space-y-6">
          <div className="flex items-center gap-2"><YouBadge /><span className="text-sm text-muted-foreground">{K.code} · {K.intro}</span></div>
          <Field label="Titre de l’analyse · facultatif" hint="Sert uniquement à retrouver l’analyse dans « Mes analyses ». Sans titre, Contre-feu reprend le début de votre description.">
            <input className={inputCls} value={a.title} onChange={(e) => up({ title: e.target.value })} />
          </Field>
          {a.kind === "concurrent" ? (
            <Field label="Signal concurrent · obligatoire" hint="Ce que vous avez appris, et par quelle voie. Écrivez-le tel qu’on vous l’a rapporté, sans l’interpréter.">
              <textarea rows={4} className={inputCls} value={a.signal} placeholder="Ex. « Un prospect m’a dit que tel concurrent teste en bêta des alertes sur… »" onChange={(e) => up({ signal: e.target.value })} />
            </Field>
          ) : (
            <>
              <Field label="Usage prévu · obligatoire" hint="Ce pour quoi la fonction a été conçue."><textarea rows={3} className={inputCls} value={a.prevu} placeholder="Ex. « Le module Réserves sert à consigner les réserves jusqu’à leur levée. »" onChange={(e) => up({ prevu: e.target.value })} /></Field>
              <Field label="Usage observé · obligatoire" hint="Ce que les utilisateurs font réellement, décrit comme vous l’avez constaté."><textarea rows={3} className={inputCls} value={a.observe} placeholder="Ex. « Des conducteurs suivent les livraisons dans le champ commentaire. »" onChange={(e) => up({ observe: e.target.value })} /></Field>
            </>
          )}
          <Field label="Contexte · facultatif" hint="Qui, où, comment, ce que vous savez du concurrent ou des comptes. Laissez vide ce que vous ne savez pas : Contre-feu le classera dans « On ignore » au lieu de l’inventer.">
            <textarea rows={3} className={inputCls} value={a.contexte} onChange={(e) => up({ contexte: e.target.value })} />
          </Field>
        </Card>
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl text-primary">Votre position de départ</h3><Pill tone="accent">Obligatoire</Pill><Pill><Lock className="mr-1 h-3 w-3" /> Masquée jusqu’à la synthèse</Pill></div>
          <p className="text-sm text-muted-foreground">Votre réaction spontanée, avant toute analyse. Elle n’est jamais transmise à l’IA : elle sert seulement à mesurer, à la fin, si votre réflexion a évolué. « Je ne sais pas encore » est une réponse valide.</p>
          {locked ? <p className="rounded-2xl bg-primary px-5 py-4 font-bold tracking-widest text-highlight">MASQUÉE · position et justification enregistrées</p> : (
            <>
              <div className="flex flex-wrap gap-2">{[...K.options, NSP].map((o) => <Chip key={o} on={a.position === o} onClick={() => up({ position: o })} dashed={o === NSP}>{o}</Chip>)}</div>
              <Field label="Justification de cette position" hint="Une ou deux phrases suffisent. Ex. « Signal trop faible, aucun impact client démontré. »"><textarea rows={2} className={inputCls} value={a.positionWhy} onChange={(e) => up({ positionWhy: e.target.value })} /></Field>
            </>
          )}
          <Field group label="Risques déjà identifiés · facultatif" hint="Ce que vous craignez déjà. Ils seront rappelés dans la synthèse finale."><ListEditor items={a.risks} onChange={(risks) => up({ risks })} placeholder="Ex. « Réaction des clients grands comptes. »" /></Field>
        </Card>
        <Card className="space-y-3 bg-secondary">
          <p className="text-sm">Le signal et le contexte seront transmis à un service d’IA externe (OpenAI). Retirez les noms de clients, de personnes, les coordonnées et toute donnée personnelle : Contre-feu ne les anonymise pas à votre place.</p>
          <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={a.anonymised} onChange={(e) => up({ anonymised: e.target.checked })} /> J’ai anonymisé les informations saisies</label>
        </Card>
      </fieldset>
    </>
  );
}

/* ———————————— 2. Comprendre ———————————— */
const READ_TONE: Record<ReadStatus, string> = { sait: "bg-success text-success-foreground", suppose: "bg-highlight text-primary", ignore: "bg-muted text-foreground" };
const READ_GLYPH: Record<ReadStatus, string> = { sait: "✓", suppose: "~", ignore: "?" };

function Understand({ a, up, onEnjeu }: { a: Analysis; up: Up; onEnjeu: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const K = KIND[a.kind];
  const save = (it: ReadingItem, text: string, st: ReadStatus) => {
    if (text === it.text && st === it.status) return setEdit(null);
    const reading = a.reading.map((x) => (x.id === it.id ? { ...x, text, status: st, orig: x.orig ?? { text: x.text, status: x.status }, source: st === "sait" && x.status !== "sait" ? "Information apportée par le PM" : x.source, quote: undefined } : x));
    up({ reading, staleEnjeu: true, staleObjections: a.objections.length > 0 });
    setEdit(null);
  };
  return (
    <>
      <Head tag="Étape 2 · la situation et l’enjeu" title={<>Comprendre la <em className="text-accent">situation</em></>} lead="Contre-feu a lu votre description. Vérifiez sa lecture : chaque élément se corrige, la formulation de l’IA reste tracée." />
      <Card className="space-y-4">
        <div className="flex items-center gap-2"><AIBadge /><h3 className="text-2xl text-primary">Ce que Contre-feu en retient</h3></div>
        {a.summary && <p className="text-lg">{a.summary}</p>}
        <div className="grid gap-3 md:grid-cols-3">
          {(["sait", "suppose", "ignore"] as const).map((s) => {
            const xs = a.reading.filter((i) => i.status === s);
            return (
              <div key={s} className="rounded-2xl bg-muted p-4">
                <p className="font-bold"><span className={cn("mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", READ_TONE[s])}>{READ_GLYPH[s]}</span>{READ_LABEL[s]} · {xs.length}</p>
                <p className="mt-2 text-sm text-muted-foreground">{xs.slice(0, 2).map((x) => x.text).join(" · ") || "—"}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-2xl text-primary">Le détail, élément par élément</h3>
        <p className="text-sm text-muted-foreground">Corrigez ce qui est faux. Après une correction, l’enjeu et les objections seront à regénérer.</p>
        <ul className="space-y-3">
          {a.reading.map((it) => (
            <li key={it.id} className="rounded-2xl border border-border p-4">
              {edit === it.id ? <ReadEditor it={it} onSave={save} onCancel={() => setEdit(null)} /> : (
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-bold uppercase tracking-wider text-muted-foreground">{it.label}</span><span className={cn("rounded-full px-2 py-0.5 font-bold", READ_TONE[it.status])}>{READ_GLYPH[it.status]} {READ_LABEL[it.status]}</span>{it.orig ? <YouBadge /> : <AIBadge />}</div>
                    <p>{it.text}</p>
                    <p className="text-xs text-muted-foreground">Source : {it.source}{it.quote ? ` · Extrait : « ${it.quote} »` : ""}</p>
                    {it.orig && <p className="text-xs text-muted-foreground">Corrigé par vous. Proposition de l’IA conservée : « {it.orig.text} » ({READ_LABEL[it.orig.status]})</p>}
                  </div>
                  <Btn variant="outline" className="min-h-9 px-4 text-sm" onClick={() => setEdit(it.id)}>Corriger</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><AIBadge /><h3 className="text-2xl text-primary">Comprendre l’enjeu</h3></div>
        {a.staleEnjeu ? (
          <div className="rounded-2xl border-2 border-dashed border-input p-5">
            <p className="font-bold">! Évaluation périmée.</p>
            <p className="text-sm">La lecture de la situation a été modifiée après cette évaluation. Aucun recalcul automatique : regénérez pour continuer.</p>
            <Btn className="mt-3" onClick={onEnjeu}><RefreshCw className="h-4 w-4" /> Regénérer l’évaluation</Btn>
          </div>
        ) : t && (
          <>
            <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
              <p className="text-xs font-bold uppercase tracking-wider text-highlight">Proposition de l’IA · {K.resultLabel}</p>
              <p className="mt-1 font-display text-4xl">{t.label}</p>
              {a.aiTrendInitial && a.aiTrendInitial !== t.label && <p className="mt-1 text-sm text-primary-foreground/70">Mis à jour après vos corrections · proposition initiale de l’IA : {a.aiTrendInitial}</p>}
              <p className="mt-2 text-sm">Confiance globale : <strong>{CONF[t.conf]}</strong> ({t.reasons.join(" ; ")})</p>
              {t.fast && <p className="mt-2 inline-block rounded-full bg-highlight px-3 py-1 text-xs font-bold text-primary">⏱ À revoir vite · urgence forte</p>}
              {a.blocking && <p className="mt-2 text-sm font-bold text-highlight">! Risque bloquant : corriger en priorité.</p>}
            </div>
            <Criteria a={a} up={up} />
            <details className="rounded-2xl bg-muted p-4 text-sm"><summary className="cursor-pointer font-bold">Comment cette tendance est calculée</summary><ul className="mt-2 list-disc space-y-1 pl-5">{t.lines.map((l) => <li key={l}>{l}</li>)}</ul></details>
            {a.corrections.length > 0 && (
              <div><p className="font-bold">Historique des corrections</p>
                <ul className="mt-2 space-y-1 text-sm">{a.corrections.map((c, i) => <li key={i}><strong>{c.name}</strong> : {c.from} → {c.to} · IA : {c.ai} · {MOTIF_LABEL[c.motif]}{c.note ? ` · « ${c.note} »` : ""}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function ReadEditor({ it, onSave, onCancel }: { it: ReadingItem; onSave: (it: ReadingItem, t: string, s: ReadStatus) => void; onCancel: () => void }) {
  const [text, setText] = useState(it.text);
  const [st, setSt] = useState<ReadStatus>(it.status);
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{it.label}</p>
      <div className="flex flex-wrap gap-2">{(["sait", "suppose", "ignore"] as const).map((s) => <Chip key={s} on={st === s} onClick={() => setSt(s)}>{READ_GLYPH[s]} {READ_LABEL[s]}</Chip>)}</div>
      <textarea rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-xs text-muted-foreground">La formulation de l’IA et sa provenance restent tracées.</p>
      <div className="flex gap-2"><Btn onClick={() => onSave(it, text.trim() || it.text, st)}>Enregistrer</Btn><Btn variant="ghost" onClick={onCancel}>Annuler</Btn></div>
    </div>
  );
}

function Criteria({ a, up }: { a: Analysis; up: Up }) {
  const [pending, setPending] = useState<{ id: string; value: number; blocking: boolean } | null>(null);
  const [motif, setMotif] = useState<Motif | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState(false);
  const max = scaleMax(a.kind);
  const lv = (n: number) => (max === 3 ? ["", "Faible", "Moyen", "Fort"][n] : `${n} / 5`);
  const groups = a.kind === "concurrent" ? [{ name: "", items: a.criteria }] : [
    { name: "Ce que l’usage apporte", items: a.criteria.filter((c) => c.cat === "apporte") },
    { name: "Ce qu’il coûte", items: a.criteria.filter((c) => c.cat === "coute") },
    { name: "", items: a.criteria.filter((c) => c.cat === "urgence") },
  ];
  const cc = pending ? a.criteria.find((c) => c.id === pending.id) : null;
  const validate = () => {
    if (!pending || !cc) return;
    if (!motif) return setErr(true);
    up({
      criteria: a.criteria.map((c) => (c.id === cc.id ? { ...c, value: pending.value, motif, note: note || undefined } : c)),
      ...(a.kind === "detournement" && cc.id === "risque" ? { blocking: pending.blocking } : {}),
      corrections: [...a.corrections, { at: new Date().toISOString(), name: cc.name, from: lv(cc.value)!, to: lv(pending.value)!, ai: lv(cc.ai)!, motif, note: note || undefined }],
      staleObjections: a.objections.length > 0,
    });
    setPending(null); setMotif(null); setNote(""); setErr(false);
  };
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-3">
          {g.name && <p className="font-bold">{g.name}</p>}
          {g.items.map((c) => {
            const v = pending?.id === c.id ? pending.value : c.value;
            return (
              <div key={c.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{c.name}</span><span className="font-mono text-sm">{lv(v)}</span></div>
                <input type="range" min={1} max={max} step={1} value={v} aria-label={c.name} className="mt-2 w-full accent-[var(--accent)]"
                  onChange={(e) => { setPending({ id: c.id, value: Number(e.target.value), blocking: a.blocking }); setMotif(null); setErr(false); }} />
                <p className="text-sm text-muted-foreground">{c.why}</p>
                {c.motif && <p className="mt-1 text-xs"><strong>IA : {lv(c.ai)} → Vous : {lv(c.value)}</strong> · {MOTIF_LABEL[c.motif]}</p>}
                {pending?.id === c.id && (
                  <div className="mt-3 space-y-3 rounded-2xl bg-secondary p-4">
                    <p className="font-bold">Panneau de correction · {c.name}</p>
                    <p className="text-sm">Proposition de l’IA : <strong>{lv(c.ai)}</strong>. Elle reste tracée après correction. Nouvelle valeur proposée : <strong>{lv(pending.value)}</strong>.</p>
                    {a.kind === "detournement" && c.id === "risque" && (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pending.blocking} onChange={(e) => setPending({ ...pending, blocking: e.target.checked })} /> Risque bloquant (sécurité, données ou légal)</label>
                    )}
                    <div role="radiogroup" aria-label="Motif" className="space-y-1 text-sm">
                      <p className="font-bold">Motif · obligatoire</p>
                      <label className="flex gap-2"><input type="radio" checked={motif === "erreur"} onChange={() => { setMotif("erreur"); setErr(false); }} /><span><strong>Erreur de l’IA</strong> : la valeur ne correspond pas aux informations disponibles.</span></label>
                      <label className="flex gap-2"><input type="radio" checked={motif === "contexte"} onChange={() => { setMotif("contexte"); setErr(false); }} /><span><strong>Information contextuelle</strong> : vous savez quelque chose que l’IA ne pouvait pas savoir.</span></label>
                      {err && <p className="font-bold text-destructive">Indiquez un motif pour valider la correction.</p>}
                    </div>
                    <input className={inputCls} placeholder="Explication complémentaire · facultatif" value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2"><Btn onClick={validate}>Valider la correction</Btn><Btn variant="ghost" onClick={() => { setPending(null); setErr(false); }}>Annuler</Btn></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Déplacez le curseur d’un critère pour proposer une autre valeur. Le motif est obligatoire ; la proposition de l’IA reste tracée, et les objections seront à regénérer.</p>
    </div>
  );
}

/* ———————————— 3. Mettre à l'épreuve ———————————— */
const SUPPORT_TONE: Record<Support, "success" | "accent" | "muted"> = { etayee: "success", reformulee: "accent", non: "muted" };
const SUPPORT_GLYPH: Record<Support, string> = { etayee: "✓", reformulee: "↻", non: "!" };
const SOLID_LABEL = { solide: "Attaque solide", partielle: "Attaque partielle", fragile: "Attaque fragile" };

function EvalQuestions({ o, onSet }: { o: Objection; onSet: (p: Partial<Objection>) => void }) {
  const Q = ({ k, label }: { k: "useful" | "novel"; label: string }) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="min-w-56 font-bold">{label}</span>
      {(["oui", "non"] as YesNo[]).map((v) => <Chip key={v} on={o[k] === v} onClick={() => onSet({ [k]: v })}>{v === "oui" ? "Oui" : "Non"}</Chip>)}
    </div>
  );
  return (
    <div className="space-y-2 rounded-2xl bg-muted p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Votre évaluation</p>
      <Q k="useful" label="Utile pour décider ?" />
      <Q k="novel" label="Nouvelle pour vous ?" />
    </div>
  );
}

function ObjectionCard({ a, o, up, compact }: { a: Analysis; o: Objection; up: Up; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const set = (p: Partial<Objection>) => up({ objections: a.objections.map((x) => (x.id === o.id ? { ...x, ...p } : x)) });
  return (
    <div className={cn("rounded-2xl border-2 p-4", o.id === a.keyObjection ? "border-accent" : "border-border")}>
      <button type="button" className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-muted-foreground">{o.role}</span>
          <Pill tone={SUPPORT_TONE[o.support]}>{SUPPORT_GLYPH[o.support]} {SUPPORT_LABEL[o.support]}</Pill>
          {o.id === a.keyObjection && <Pill tone="accent">Décisive pour vous</Pill>}
          {o.useful && o.novel && <Pill tone="soft">✓ Évaluée</Pill>}
        </div>
        <p className={cn("mt-2", !open && "line-clamp-2")}>{o.text}</p>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {o.support === "reformulee" && o.initial && <p className="text-sm text-muted-foreground"><strong>Reformulée</strong> — formulation initiale non soutenue par les faits : {o.initial}</p>}
          {o.support === "non" && <p className="text-sm text-muted-foreground"><strong>Non étayée</strong> — aucune information connue ne la soutient. À lire comme une hypothèse, pas comme un fait.</p>}
          {o.premises.length > 0 && (
            <div className="text-sm"><p className="font-bold">Sur quoi elle repose · {o.premises.length}</p>
              <ul className="mt-1 space-y-1">{o.premises.map((p, i) => <li key={i}><span className={cn("mr-2 rounded-full px-2 py-0.5 text-xs font-bold", READ_TONE[p.status])}>{READ_GLYPH[p.status]} {READ_LABEL[p.status]}</span>{p.text} <span className="text-muted-foreground">— {p.src}</span></li>)}</ul>
            </div>
          )}
          <EvalQuestions o={o} onSet={set} />
        </div>
      )}
    </div>
  );
}

function Test({ a, up, onRegen }: { a: Analysis; up: Up; onRegen: () => void }) {
  const K = KIND[a.kind];
  const [opt, setOpt] = useState(K.options[0]!);
  const es = evalStats(a);
  return (
    <>
      <Head tag="Étape 3 · le cœur de Contre-feu" title={<>Mettre les options à l’<em className="text-accent">épreuve</em></>} lead={`Chaque option est attaquée par trois rôles : ${K.roles.join(", ")}. Lisez chaque objection et dites si elle vous est utile et nouvelle : ce sont vos réponses qui calculent l’issue de l’analyse. Votre position de départ figure parmi ces options, sans être signalée.`} />
      {a.staleObjections && (
        <Card className="border-2 border-dashed border-input">
          <p className="font-bold">! Objections périmées.</p>
          <p className="text-sm">La lecture ou les critères ont été corrigés après leur génération. Regénérez-les : vos évaluations seront remises à zéro.</p>
          <Btn className="mt-3" onClick={onRegen}><RefreshCw className="h-4 w-4" /> Regénérer les objections</Btn>
        </Card>
      )}
      {!a.objections.length && !a.staleObjections && <Card><p>Aucune objection pour l’instant.</p><Btn className="mt-3" onClick={onRegen}><Sparkles className="h-4 w-4" /> Lancer la mise à l’épreuve</Btn></Card>}
      {a.objections.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm"><AIBadge /><span>Objections rédigées par l’IA, dans le rôle de chaque partie.</span><span className="ml-auto font-mono">{es.done} / {es.total} évaluées</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            {K.options.map((o) => {
              const s = solidity(a, o);
              const n = a.objections.filter((x) => x.option === o);
              return (
                <button key={o} type="button" onClick={() => setOpt(o)} className={cn("rounded-3xl border-2 p-5 text-left", opt === o ? "border-primary bg-card" : "border-border bg-card/60")}>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Option {K.options.indexOf(o) + 1}</p>
                  <p className="font-display text-3xl text-primary">{o}</p>
                  <p className="mt-1 text-sm font-bold">{SOLID_LABEL[s]}</p>
                  <p className="text-xs text-muted-foreground">{n.filter((x) => x.support === "etayee").length} étayée(s) · {n.filter((x) => x.useful && x.novel).length}/{n.length} évaluée(s)</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground"><strong>Solidité de l’attaque</strong> : solide si au moins deux objections sont étayées, partielle s’il y en a une, fragile sinon.</p>
          <div className="space-y-3">{a.objections.filter((x) => x.option === opt).map((o) => <ObjectionCard key={o.id} a={a} o={o} up={up} />)}</div>
        </>
      )}
    </>
  );
}

/* ———————————— 4. Décider ———————————— */
function Decide({ a, up, trendLabel, tried }: { a: Analysis; up: Up; trendLabel: string | null; tried: boolean }) {
  const K = KIND[a.kind];
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const errs = tried ? [...decideErrors(a, trendLabel), ...closeErrors(a)] : [];
  const es = evalStats(a);
  const oc = outcome(a);
  const left = a.objections.filter((o) => !o.useful || !o.novel);
  return (
    <>
      <Head tag="Étape 4 · décision et bilan" title={<><em className="text-accent">Décider</em></>} lead="La tendance proposée par l’IA et votre décision restent distinctes : aucune n’écrase l’autre. Votre position de départ est maintenant révélée." />
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="bg-primary text-primary-foreground">
          <p className="text-xs font-bold uppercase tracking-wider text-highlight">Tendance proposée par l’IA</p>
          <p className="mt-1 font-display text-4xl">{t?.label ?? "—"}</p>
          <p className="mt-2 text-sm">Confiance : {t ? CONF[t.conf] : "—"}</p>
          {a.aiTrendInitial && a.aiTrendInitial !== t?.label && <p className="mt-1 text-sm text-primary-foreground/70">Proposition initiale de l’IA, avant vos corrections : {a.aiTrendInitial} · conservée dans la synthèse</p>}
          {t?.partagee && <p className="mt-2 text-sm">◐ Apporte ou Coûte en catégorie partagée : l’IA ne tranche pas. Votre décision devra être justifiée.</p>}
          {t?.fast && <p className="mt-2 text-sm font-bold text-highlight">⏱ À revoir vite</p>}
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Votre position de départ · révélée</p>
          <p className="mt-1 font-display text-4xl text-primary">{a.position}</p>
          {a.positionWhy && <p className="mt-2 text-sm"><strong>Justification :</strong> {a.positionWhy}</p>}
          {filled(a.risks).length > 0 && <p className="mt-1 text-sm"><strong>Risques déjà identifiés :</strong> {filled(a.risks).join(" ; ")}</p>}
        </Card>
      </div>

      <Card className="space-y-5">
        <h3 className="text-2xl text-primary">Votre décision</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {K.decisions.map((d) => (
            <button key={d} type="button" aria-pressed={a.decision === d} onClick={() => up({ decision: d })}
              className={cn("rounded-2xl border-2 p-4 text-left", a.decision === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-input")}>
              <span className="flex flex-wrap items-center gap-2 font-bold">{d}
                {d === t?.label && <span className="rounded-full bg-highlight px-2 py-0.5 text-xs text-primary">Proposition IA</span>}
                {d === a.position && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">Position de départ</span>}
              </span>
              <span className="mt-1 block text-sm opacity-80">{K.desc[d]}</span>
            </button>
          ))}
        </div>
        <Field label={`Pourquoi ce choix ?${a.decision && trendLabel && a.decision !== trendLabel ? " · obligatoire" : " · facultatif"}`} hint="Ce qui a fait pencher la balance, en une ou deux phrases. Si vous vous écartez de l’IA, dites ce qu’elle n’a pas pris en compte. Ce texte apparaît tel quel dans la synthèse.">
          <textarea rows={3} className={inputCls} value={a.decisionWhy} onChange={(e) => up({ decisionWhy: e.target.value })} />
        </Field>
        <Field label="Objection déterminante · facultatif" hint="L’objection qui a fait évoluer ou conforté votre décision, s’il y en a une.">
          <select className={inputCls} value={a.keyObjection ?? ""} onChange={(e) => up({ keyObjection: e.target.value || undefined })}>
            <option value="">Aucune</option>
            {a.objections.map((o) => <option key={o.id} value={o.id}>{o.option} · {o.role} — {o.text.slice(0, 80)}</option>)}
          </select>
        </Field>
        <div className="space-y-3">
          <p className="font-bold">Quand y revenir ? · obligatoire</p>
          <p className="text-sm text-muted-foreground">Une date de revue ou un signal déclencheur, et une idée de mesure. Un signal déclencheur est un événement concret qui rouvre la question ; la mesure, un indicateur simple que vous pouvez suivre.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Date de revue"><input type="date" className={inputCls} value={a.reviewDate} onChange={(e) => up({ reviewDate: e.target.value })} /></Field>
            <Field label="ou signal déclencheur"><input className={inputCls} value={a.trigger} placeholder="Ex. annonce publique du concurrent" onChange={(e) => up({ trigger: e.target.value })} /></Field>
          </div>
          <Field label="Idée de mesure"><input className={inputCls} value={a.measure} placeholder="Ex. demandes clients liées au sujet par mois" onChange={(e) => up({ measure: e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="space-y-5">
        <h3 className="text-2xl text-primary">Bilan de l’analyse</h3>
        <p className="text-sm text-muted-foreground">L’issue se calcule à partir de vos réponses sur les objections. Terminez ici celles qui restent, puis répondez aux deux dernières questions.</p>
        <p className="font-mono text-lg">{es.done} / {es.total} <span className="font-sans text-sm">objections évaluées</span></p>
        {left.length > 0 ? (
          <div className="space-y-3">
            <p className="rounded-2xl border-2 border-dashed border-input p-4 text-sm"><strong>… Évaluation incomplète · {left.length} objection{left.length > 1 ? "s" : ""} restante{left.length > 1 ? "s" : ""}.</strong> L’issue ne sera calculée qu’une fois toutes les objections évaluées. Vous pouvez quitter : l’analyse reste reprenable.</p>
            {left.map((o) => <div key={o.id}><p className="mb-1 text-xs font-bold text-muted-foreground">Option {o.option}</p><ObjectionCard a={a} o={o} up={up} compact /></div>)}
          </div>
        ) : oc ? (
          <div className={cn("rounded-3xl p-6", oc.success ? "bg-success-soft text-success" : "bg-secondary text-secondary-foreground")}>
            <p className="text-xs font-bold uppercase tracking-wider">Issue calculée · non modifiable</p>
            <p className="font-display text-4xl">{oc.success ? "✓" : "✕"} {oc.label}</p>
            <ul className="mt-2 space-y-1 text-sm">{oc.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        ) : <p className="text-sm">Choisissez une décision pour calculer l’issue.</p>}

        <div className="space-y-4">
          <p className="font-bold">Deux dernières questions</p>
          <p className="text-sm text-muted-foreground">Elles n’entrent pas dans le calcul de l’issue.</p>
          <Scale label="Les objections étaient-elles pertinentes pour votre situation ?" lo="Pas du tout" hi="Tout à fait" value={a.pertinence} onChange={(pertinence) => up({ pertinence })} />
          <Scale label="L’analyse vous a-t-elle demandé un effort raisonnable ?" lo="Trop d’effort" hi="Très raisonnable" value={a.effort} onChange={(effort) => up({ effort })} />
        </div>
      </Card>

      {errs.length > 0 && (
        <Card className="border-2 border-destructive/40">
          <p className="font-bold text-destructive">! Pour clore l’analyse :</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{errs.map((e) => <li key={e}>{e}</li>)}</ul>
        </Card>
      )}
    </>
  );
}

function Scale({ label, lo, hi, value, onChange }: { label: string; lo: string; hi: string; value: number | undefined; onChange: (n: number) => void }) {
  return (
    <div role="group" aria-label={label} className="space-y-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{lo}</span>
        {[1, 2, 3, 4, 5].map((n) => <Chip key={n} on={value === n} onClick={() => onChange(n)}>{n}</Chip>)}
        <span>{hi}</span>
      </div>
    </div>
  );
}
