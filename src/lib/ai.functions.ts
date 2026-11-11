import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// La position de départ n'est jamais transmise à l'IA.
const Input = z.object({
  task: z.enum(["lecture", "enjeu", "objections"]),
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
    const key = process.env["OPENAI_API_KEY"];
    if (!key) return { result: "", error: "Clé OpenAI absente." };
    const conc = data.kind === "concurrent";
    const scale = conc ? "1 (faible) à 3 (fort)" : "1 (faible) à 5 (fort)";
    const ctx = conc
      ? `Mouvement concurrent.\nSignal : ${data.signal}\nContexte : ${data.contexte || "(non renseigné)"}`
      : `Détournement d'usage.\nUsage prévu : ${data.prevu}\nUsage observé : ${data.observe}\nContexte : ${data.contexte || "(non renseigné)"}`;
    const reading = data.reading.map((r) => `- [${r.status}] ${r.text}`).join("\n");
    const critList = data.criteria.map((c) => `${c.id} (${c.name})`).join(", ");
    const critJson = `"criteria":[{"id":"...","value":entier ${scale},"why":"justification courte"}]${conc ? "" : ',"blocking":true si un risque de sécurité, données personnelles ou légal est avéré, sinon false'}`;
    let prompt: string;
    if (data.task === "lecture") {
      prompt = `${ctx}\n\nProduis une lecture de la situation. Ne reprends pas le texte, classe les éléments. N'invente rien : ce qui n'est pas dit va dans "ignore".\nJSON : {"summary":"2 phrases","items":[{"label":"thème court","status":"sait|suppose|ignore","text":"...","source":"d'où vient l'élément","quote":"extrait exact de la saisie ou vide"}],${critJson}}\n6 à 9 items. Critères : ${critList}.`;
    } else if (data.task === "enjeu") {
      prompt = `${ctx}\n\nLecture validée par le PM :\n${reading}\n\nÉvalue l'enjeu. JSON : {${critJson}}. Critères : ${critList}.`;
    } else {
      prompt = `${ctx}\n\nLecture validée :\n${reading}\nCritères retenus : ${data.scores.map((s) => `${s.name}=${s.value}`).join(", ")}\n\nPour chaque option (${data.options.join(", ")}), écris exactement une objection sévère par rôle (${data.roles.join(", ")}), à la première personne du rôle. Statut : "etayee" si elle s'appuie sur un élément « sait », "reformulee" si tu as dû corriger une formulation initiale non soutenue par les faits (donne "initial"), "non" sinon.\nJSON : {"objections":[{"option":"...","role":"...","text":"...","support":"etayee|reformulee|non","initial":"","premises":[{"status":"sait|suppose|ignore","text":"...","src":"..."}]}]}`;
    }
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Tu es Contre-feu, une aide à la décision pour Product Managers SaaS B2B. Tu réponds en français, en JSON strict. Tu ne décides jamais à la place du PM." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!r.ok) {
        console.error("OpenAI", r.status, await r.text());
        return { result: "", error: r.status === 401 ? "La clé OpenAI est refusée." : r.status === 429 ? "Limite OpenAI atteinte, réessayez plus tard." : "Le service IA n’a pas répondu." };
      }
      const j = await r.json();
      return { result: String(j.choices?.[0]?.message?.content ?? ""), error: "" };
    } catch (e) {
      console.error(e);
      return { result: "", error: "Le service IA n’a pas répondu." };
    }
  });
