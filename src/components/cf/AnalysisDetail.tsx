import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Copy, ExternalLink, RotateCcw, UploadCloud } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { saveToNotion } from "@/lib/notion.functions";
import type { ReactNode } from "react";
import { Btn, Pill } from "@/components/cf/ui";
import {
  CONF, FICHES, KIND, MOTIF_LABEL, READ_LABEL, STATUS, STEPS, SUPPORT_LABEL,
  duplicateAnalysis, ficheKey, filled, outcome, reopenAnalysis, scaleMax, solidity, status, trend,
  type Analysis, type ReadStatus,
} from "@/lib/analyses";
import { getAnalysis, saveAnalysis, useUserName } from "@/lib/store";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
const READ_TONE: Record<ReadStatus, "primary" | "accent" | "muted"> = { sait: "primary", suppose: "accent", ignore: "muted" };
const yn = (v?: string) => (v === "oui" ? "Oui" : v === "non" ? "Non" : "—");

/** Dupliquer (repartir du même contexte) et rouvrir (modifier une analyse close). */
export function AnalysisActions({ a }: { a: Analysis }) {
  const navigate = useNavigate();
  const s = status(a);
  const closed = s === "evaluee" || s === "abandonnee";
  const duplicate = () => {
    const c = duplicateAnalysis(a, crypto.randomUUID(), new Date());
    saveAnalysis(c);
    navigate({ to: "/analyse/$id", params: { id: c.id } });
  };
  const reopen = () => {
    const msg = s === "evaluee"
      ? "Rouvrir cette analyse ? Elle redevient modifiable ; l’issue sera recalculée quand vous la clorez à nouveau. La réouverture reste tracée dans le détail."
      : "Reprendre cette analyse abandonnée ? Elle redevient modifiable à l’étape atteinte. La réouverture reste tracée dans le détail.";
    if (!window.confirm(msg)) return;
    saveAnalysis(reopenAnalysis(getAnalysis(a.id) ?? a, new Date()));
    navigate({ to: "/analyse/$id", params: { id: a.id } });
  };
  const push = useServerFn(saveToNotion);
  const pm = useUserName();
  const [sync, setSync] = useState<{ busy?: boolean; url?: string; error?: string }>({});
  const toNotion = async () => {
    setSync({ busy: true });
    try {
      const r = await push({ data: { analysis: (getAnalysis(a.id) ?? a) as unknown as { id: string }, pm } });
      setSync(r.error ? { error: r.error } : { url: r.url });
    } catch { setSync({ error: "Notion n’a pas répondu." }); }
  };
  return (
    <>
      <Btn variant="outline" onClick={toNotion} disabled={sync.busy}><UploadCloud className="h-4 w-4" /> {sync.busy ? "Enregistrement…" : sync.url ? "Mettre à jour dans Notion" : "Enregistrer dans Notion"}</Btn>
      {sync.url && <a href={sync.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-accent">Enregistrée · ouvrir dans Notion <ExternalLink className="h-3.5 w-3.5" /></a>}
      {sync.error && <p role="alert" className="w-full text-sm font-bold text-destructive">{sync.error}</p>}
      <Btn variant="outline" onClick={duplicate} title="Nouvelle analyse avec la même description et les mêmes fiches de contexte"><Copy className="h-4 w-4" /> Dupliquer</Btn>
      {closed && <Btn variant="outline" onClick={reopen}><RotateCcw className="h-4 w-4" /> {s === "evaluee" ? "Rouvrir pour modifier" : "Reprendre"}</Btn>}
    </>
  );
}

function Section({ n, title, sub, children, open }: { n: number; title: string; sub?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 md:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs text-highlight">{n}</span>
        <span className="min-w-0 flex-1"><span className="block font-display text-xl leading-tight text-primary">{title}</span>{sub && <span className="block text-sm text-muted-foreground">{sub}</span>}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-5 border-t border-border px-4 py-4 text-sm md:px-5">{children}</div>
    </details>
  );
}

/** Titre d'un bloc dans une étape : plus marqué qu'une étiquette de champ. */
const H = ({ children }: { children: ReactNode }) => <h4 className="mb-2 border-l-2 border-accent pl-2 font-sans text-sm font-bold text-primary">{children}</h4>;
const Label = ({ children }: { children: ReactNode }) => <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
const Empty = () => <p className="text-muted-foreground">Non renseigné.</p>;

function KV({ k, v }: { k: string; v?: ReactNode }) {
  return <div className="min-w-0"><Label>{k}</Label><div className="mt-0.5 break-words">{v || <span className="text-muted-foreground">—</span>}</div></div>;
}

/** Tout le raisonnement de l'analyse, étape par étape, pour vérifier un arbitrage précis. */
export function AnalysisDetail({ a }: { a: Analysis }) {
  const K = KIND[a.kind];
  const t = trend(a.kind, a.criteria, a.reading, a.blocking);
  const oc = outcome(a);
  const max = scaleMax(a.kind);
  const key = a.keyObjection;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm font-bold text-accent no-print">
        <button type="button" onClick={(e) => e.currentTarget.closest("div")!.parentElement!.querySelectorAll("details").forEach((d) => (d.open = true))}>Tout déplier</button>
        <button type="button" onClick={(e) => e.currentTarget.closest("div")!.parentElement!.querySelectorAll("details").forEach((d) => (d.open = false))}>Tout replier</button>
      </div>

      <Section n={1} title={STEPS[0].label} sub="Signal, contexte et position de départ" open>
        <div className="grid gap-4 md:grid-cols-2">
          {a.kind === "concurrent" ? <KV k="Signal concurrent" v={a.signal} /> : <><KV k="Usage prévu" v={a.prevu} /><KV k="Usage observé" v={a.observe} /></>}
          <KV k="Contexte complémentaire" v={a.contexte} />
          <KV k="Position de départ" v={a.position && <strong>{a.position}</strong>} />
          <KV k="Pourquoi cette position" v={a.positionWhy} />
        </div>
        {filled(a.risks).length > 0 && <div><H>Risques déjà identifiés</H><ul className="list-disc pl-5">{filled(a.risks).map((r) => <li key={r}>{r}</li>)}</ul></div>}
        {FICHES[a.kind].map((f) => (
          <div key={f.id}>
            <H>{f.title}</H>
            <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
              {f.fields.map((x) => <div key={x.key} className="min-w-0"><dt className="text-muted-foreground">{x.label}</dt><dd className="break-words">{(a.fiches[ficheKey(f.id, x.key)] ?? "").trim() || "—"}</dd></div>)}
            </dl>
          </div>
        ))}
      </Section>

      <Section n={2} title={STEPS[1].label} sub={`${a.questions.length} question${a.questions.length > 1 ? "s" : ""} · ${a.reading.length} élément${a.reading.length > 1 ? "s" : ""} de lecture`}>
        {a.summary && <div><H>Synthèse de l’IA</H><p>{a.summary}</p></div>}
        <div>
          <H>Questions de l’IA et vos réponses</H>
          {a.questions.length ? (
            <ol className="grid gap-2 md:grid-cols-2">{a.questions.map((q, i) => (
              <li key={q.id} className="rounded-xl bg-muted px-3 py-2.5">
                <p className="font-bold">{i + 1}. {q.text}</p>
                {q.why && <p className="text-xs text-muted-foreground">Pour {q.why}</p>}
                <p className="mt-1">{q.skipped ? <em className="text-muted-foreground">Question passée</em> : q.answer.trim() || <em className="text-muted-foreground">Sans réponse</em>}</p>
              </li>
            ))}</ol>
          ) : <Empty />}
        </div>
        <div>
          <H>On sait · on suppose · on ignore</H>
          {a.reading.length ? (
            <div className="grid gap-3 md:grid-cols-3">{(["sait", "suppose", "ignore"] as const).map((st) => {
              const items = a.reading.filter((r) => r.status === st);
              return (
                <div key={st} className="min-w-0 rounded-xl bg-muted p-2.5">
                  <p className="mb-2 flex items-center justify-between"><Pill tone={READ_TONE[st]}>{READ_LABEL[st]}</Pill><span className="font-mono text-xs text-muted-foreground">{items.length}</span></p>
                  {items.length ? <ul className="space-y-2">{items.map((r) => (
                    <li key={r.id} className="rounded-lg bg-card px-3 py-2">
                      {(r.label || r.orig) && <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold">{r.label}{r.orig && <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">Corrigé</span>}</p>}
                      <p>{r.text}</p>
                      {r.source && <p className="text-xs text-muted-foreground">{r.source}{r.quote ? ` · « ${r.quote} »` : ""}</p>}
                      {r.orig && <p className="mt-1 text-xs text-muted-foreground">IA au départ ({READ_LABEL[r.orig.status]}) : {r.orig.text}</p>}
                    </li>
                  ))}</ul> : <p className="text-xs text-muted-foreground">Rien.</p>}
                </div>
              );
            })}</div>
          ) : <Empty />}
        </div>
        {a.scenarios.length > 0 && (
          <div><H>Scénarios de riposte</H>
            <div className="grid gap-2 md:grid-cols-3">{a.scenarios.map((s) => (
              <div key={s.name} className="rounded-xl bg-muted px-3 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">{s.name} · {s.proof}</p>
                <p className="font-bold">{s.title}</p><p>{s.desc}</p>
                {s.gains.length > 0 && <p className="mt-1 text-xs">Gains : {s.gains.join(", ")}</p>}
                {s.facts.length > 0 && <p className="text-xs">Faits : {s.facts.join(" ; ")}</p>}
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
            ))}</div>
          </div>
        )}
        {a.manques.length > 0 && (
          <div><H>Ce que l’usage révèle comme manque</H>
            <ul className="grid gap-2 md:grid-cols-2">{a.manques.map((m) => (
              <li key={m.id} className="rounded-xl bg-muted px-3 py-2.5"><p className="font-bold">{m.title} {a.manqueId === m.id && <Pill tone="primary">Retenu</Pill>}</p><p className="text-xs text-muted-foreground">{m.proof} · appui : {m.appui}</p></li>
            ))}</ul>
          </div>
        )}
        {a.po && (
          <div><H>Problème ou opportunité · {a.po.label}</H>
            <div className="mt-1 grid gap-3 md:grid-cols-2">
              <div><p className="font-bold">Pour</p><ul className="list-disc pl-5">{a.po.pro.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><p className="font-bold">Contre</p><ul className="list-disc pl-5">{a.po.con.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          </div>
        )}
      </Section>

      <Section n={3} title={STEPS[2].label} sub={`Tendance : ${t?.label ?? "—"} · confiance ${t ? CONF[t.conf] : "—"}`}>
        {a.criteria.length ? (
          <ul className="grid gap-2 md:grid-cols-2">{a.criteria.map((c) => (
            <li key={c.id} className="rounded-xl border border-border px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{c.name}</span>
                <span className="font-mono">{c.value}/{max}{c.value !== c.ai && <span className="text-muted-foreground"> · IA : {c.ai}/{max}</span>}</span>
              </div>
              {c.why && <p className="mt-1 text-muted-foreground">IA : {c.why}</p>}
              {c.motif && <p className="mt-1"><Pill tone="accent">Ajusté · {MOTIF_LABEL[c.motif]}</Pill>{c.note && <span className="ml-2">{c.note}</span>}</p>}
            </li>
          ))}</ul>
        ) : <Empty />}
        {a.kind === "detournement" && <p>Risque bloquant : <strong>{a.blocking ? "Oui" : "Non"}</strong></p>}
        {a.aiTrendInitial && a.aiTrendInitial !== t?.label && <p>Proposition initiale de l’IA : <strong>{a.aiTrendInitial}</strong> ; tendance après vos ajustements : <strong>{t?.label}</strong>.</p>}
        {a.corrections.length > 0 && (
          <div><H>Journal des corrections</H>
            <ul className="mt-1 space-y-1">{a.corrections.map((c, i) => <li key={i}>{fmt(c.at)} · <strong>{c.name}</strong> : {c.from} → {c.to} (IA : {c.ai}) · {MOTIF_LABEL[c.motif]}{c.note ? ` — ${c.note}` : ""}</li>)}</ul>
          </div>
        )}
      </Section>

      <Section n={4} title={STEPS[3].label} sub={`${a.objections.length} objection${a.objections.length > 1 ? "s" : ""} sur ${K.options.length} options`}>
        {K.options.map((opt) => {
          const os = a.objections.filter((o) => o.option === opt);
          if (!os.length) return null;
          return (
            <div key={opt}>
              <p className="flex flex-wrap items-center gap-2"><span className="font-bold text-primary">Option · {opt}</span><Pill tone="muted">Solidité : {solidity(a, opt)}</Pill></p>
              <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{os.map((o) => (
                <li key={o.id} className={`min-w-0 rounded-xl border px-3 py-2.5 ${key === o.id ? "border-2 border-primary" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{o.role}</span><Pill tone={o.support === "etayee" ? "primary" : o.support === "reformulee" ? "accent" : "muted"}>{SUPPORT_LABEL[o.support]}</Pill>{key === o.id && <Pill tone="primary">Objection déterminante</Pill>}</div>
                  <p className="mt-1">« {o.text} »</p>
                  {o.initial && <p className="text-xs text-muted-foreground">Formulation initiale : {o.initial}</p>}
                  {o.premises.length > 0 && <ul className="mt-1 space-y-0.5 text-xs">{o.premises.map((p, i) => <li key={i}><strong>{READ_LABEL[p.status]}</strong> · {p.text}{p.src ? ` (${p.src})` : ""}</li>)}</ul>}
                  <p className="mt-2 text-xs">Utile pour décider : <strong>{yn(o.useful)}</strong> · Nouvelle : <strong>{yn(o.novel)}</strong>{o.useful === "oui" && o.novel === "oui" ? " · compte comme apport utile" : ""}</p>
                </li>
              ))}</ul>
            </div>
          );
        })}
        {!a.objections.length && <Empty />}
      </Section>

      <Section n={5} title={STEPS[4].label} sub={a.decision ? `Décision : ${a.decision}` : "Pas encore décidée"}>
        <div className="grid gap-4 md:grid-cols-2">
          <KV k="Position de départ" v={a.position} />
          <KV k="Recommandation de l’IA" v={t ? `${t.label} · confiance ${CONF[t.conf]}` : undefined} />
          <KV k="Décision du PM" v={a.decision && <strong>{a.decision}</strong>} />
          <KV k="Pourquoi" v={a.decisionWhy} />
          <KV k="Date de revue" v={a.reviewDate ? fmt(a.reviewDate) : undefined} />
          <KV k="Signal déclencheur" v={a.trigger} />
          <KV k="Idée de mesure" v={a.measure} />
        </div>
      </Section>

      <Section n={6} title={STEPS[5].label} sub={oc ? `Issue : ${oc.label}` : "Issue non calculée"}>
        {oc ? <div><p className="font-display text-2xl text-primary">{oc.label}</p><ul className="mt-1 list-disc pl-5">{oc.lines.map((l) => <li key={l}>{l}</li>)}</ul></div> : <Empty />}
        {a.review && (
          <div className="rounded-2xl bg-muted p-3"><Label>Revue du {fmt(a.review.date)}</Label>
            <p className="mt-1">La décision tient : <strong>{{ oui: "Oui", en_partie: "En partie", non: "Non" }[a.review.holds]}</strong>{a.review.verified ? ` · hypothèses vérifiées : ${a.review.verified === "na" ? "sans objet" : yn(a.review.verified)}` : ""}</p>
            {a.review.note && <p>{a.review.note}</p>}
          </div>
        )}
      </Section>

      <div className="rounded-3xl border border-dashed border-border p-5 text-sm">
        <Label>Historique</Label>
        <ul className="mt-1 space-y-1">
          <li>Créée le {fmt(a.createdAt)} · modifiée le {fmt(a.updatedAt)} · statut : {STATUS[status(a)].label}</li>
          {a.duplicatedFrom && <li>Dupliquée de <Link to="/synthese/$id" params={{ id: a.duplicatedFrom.id }} className="font-bold text-accent">{a.duplicatedFrom.title}</Link></li>}
          {(a.reopenings ?? []).map((r, i) => <li key={i}>Rouverte le {fmt(r.at)} · était {r.was === "evaluee" ? `évaluée le ${fmt(r.completedAt)}` : "abandonnée"}{r.decision ? `, décision alors : ${r.decision}` : ""}</li>)}
          {a.completedAt && <li>Clôturée le {fmt(a.completedAt)}</li>}
        </ul>
      </div>
    </div>
  );
}

