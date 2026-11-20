import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mockAI } from "./ai.mock";

// La position de départ n'est jamais transmise à l'IA.
const Input = z.object({
  task: z.enum(["questions", "lecture", "enjeu", "objections"]),
  fiches: z.string().max(6000).default(""),
  answers: z.array(z.object({ q: z.string(), a: z.string() })).max(10).default([]),
  kind: z.enum(["concurrent", "detournement"]),
  signal: z.string().max(6000),
  prevu: z.string().max(3000),
  observe: z.string().max(3000),
  contexte: z.string().max(3000),
  options: z.array(z.string()).max(5),
  roles: z.array(z.string()).max(5),
  criteria: z.array(z.object({ id: z.string(), name: z.string() })).max(8),
  reading: z.array(z.object({ status: z.string(), text: z.string() })).max(40),
  scores: z.array(z.object({ name: z.string(), value: z.number() })).max(8),
});

export const runAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // IA simulée pour les correctifs visuels : local uniquement (AI_MOCK=1), jamais en production.
    if (process.env["AI_MOCK"] === "1" && process.env["NODE_ENV"] !== "production") {
      await new Promise((r) => setTimeout(r, 600));
      return { result: JSON.stringify(mockAI(data)), error: "" };
    }
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { result: "", error: "Clé IA absente." };
    const conc = data.kind === "concurrent";
    const scale = conc ? "1 (faible) à 3 (fort)" : "1 (faible) à 5 (fort)";
    const ctx = conc
      ? `Mouvement concurrent.\nSignal : ${data.signal}\nContexte : ${data.contexte || "(non renseigné)"}\n${data.fiches}`
      : `Détournement d'usage.\nUsage prévu : ${data.prevu}\nUsage observé : ${data.observe}\nContexte d'utilisation : ${data.contexte || "(non renseigné)"}\n${data.fiches}`;
    const answers = data.answers.length ? `\nRéponses du PM aux questions :\n${data.answers.map((x) => `- ${x.q} → ${x.a || "(passée, sans réponse)"}`).join("\n")}` : "";
    const reading = data.reading.map((r) => `- [${r.status}] ${r.text}`).join("\n");
    const critList = data.criteria.map((c) => `${c.id} (${c.name})`).join(", ");
    const critJson = `"criteria":[{"id":"...","value":entier ${scale},"why":"justification courte"}]${conc ? "" : ',"blocking":true si un risque de sécurité, données personnelles ou légal est avéré, sinon false'}`;
    let prompt: string;
    const extra = conc
      ? `,"scenarios":[{"name":"Minimal|Probable|Ambitieux","proof":"rapportée|spéculative|établie","title":"ce que prépare le concurrent","desc":"...","gains":["Upsell|New business|Rétention"],"facts":["fait du contexte qui soutient l'hypothèse"],"note":"si aucun fait ne l'étaie, dis-le, sinon vide"}]` + " (exactement 3 scénarios : Minimal, Probable, Ambitieux)"
      : `,"manques":[{"proof":"rapportée|spéculative","title":"manque du produit que compense ce détournement","appui":"élément du contexte qui l'appuie"}],"po":{"label":"plutôt une opportunité|plutôt un problème","pro":["argument pour l'opportunité"],"con":["argument pour le problème"]}` + " (2 à 3 manques)";
    if (data.task === "questions") {
      prompt = `${ctx}\n\nAvant d'analyser, pose 3 ou 4 questions de clarification au PM, sur ce qui manque le plus pour juger (sources, volume, clients, calendrier, données). Courtes, une information par question.\nJSON : {"questions":[{"text":"question ?","why":"ce que la réponse permet de juger, en quelques mots"}]}`;
    } else if (data.task === "lecture") {
      prompt = `${ctx}${answers}\n\nProduis une lecture de la situation. Ne reprends pas le texte, classe les éléments. N'invente rien : ce qui n'est pas dit va dans "ignore", avec dans "source" pourquoi c'est important. Une question passée devient un élément "ignore".\nJSON : {"summary":"2 phrases","items":[{"label":"thème court","status":"sait|suppose|ignore","text":"...","source":"source pour sait, justification pour suppose, pourquoi c'est important pour ignore","quote":"extrait exact de la saisie ou de la réponse, sinon vide"}],${critJson}${extra}}\n6 à 10 items. Critères : ${critList}.`;
    } else if (data.task === "enjeu") {
      prompt = `${ctx}${answers}\n\nLecture validée par le PM :\n${reading}\n\nÉvalue l'enjeu. JSON : {${critJson}}. Critères : ${critList}.`;
    } else {
      prompt = `${ctx}${answers}\n\nLecture validée :\n${reading}\nCritères retenus : ${data.scores.map((s) => `${s.name}=${s.value}`).join(", ")}\n\nPour chaque option (${data.options.join(", ")}), écris exactement une objection sévère par rôle (${data.roles.join(", ")}), à la première personne du rôle. Il faut donc ${data.options.length * data.roles.length} objections au total, une pour chaque couple : ${data.options.flatMap((o) => data.roles.map((r) => `${o}/${r}`)).join(", ")}. Statut : "etayee" si elle s'appuie sur un élément « sait », "reformulee" si tu as dû corriger une formulation initiale non soutenue par les faits (donne "initial"), "non" sinon.\nJSON : {"objections":[{"option":"...","role":"...","text":"...","support":"etayee|reformulee|non","initial":"","premises":[{"status":"sait|suppose|ignore","text":"...","src":"..."}]}]}`;
    }
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Lovable-API-Key": key, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: "openai/gpt-6-luna",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Tu es Contre-feu, une aide à la décision pour Product Managers SaaS B2B. Tu réponds en français, en JSON strict. Tu ne décides jamais à la place du PM." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!r.ok) {
        console.error("AI gateway", r.status, await r.text());
        return { result: "", error: r.status === 401 ? "La clé IA est refusée." : r.status === 429 ? "Limite IA atteinte, réessayez plus tard." : "Le service IA n’a pas répondu." };
      }
      const j = await r.json();
      return { result: String(j.choices?.[0]?.message?.content ?? ""), error: "" };
    } catch (e) {
      console.error(e);
      return { result: "", error: "Le service IA n’a pas répondu." };
    }
  });
