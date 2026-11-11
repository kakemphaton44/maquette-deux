import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  task: z.enum(["lecture", "objections"]),
  kind: z.enum(["concurrent", "detournement"]),
  title: z.string().max(300),
  signal: z.string().max(6000),
  startPosition: z.string().max(100),
  options: z.array(z.string()).max(5),
  voices: z.array(z.object({ id: z.string(), label: z.string() })).max(5),
  known: z.array(z.string()).max(30),
  assumed: z.array(z.string()).max(30),
});

export const runAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["OPENAI_API_KEY"];
    if (!key) return { result: "", error: "Clé OpenAI absente." };
    const ctx = `Type : ${data.kind === "concurrent" ? "mouvement concurrent" : "détournement d'usage"}\nTitre : ${data.title}\nSignal : ${data.signal}\nPosition de départ : ${data.startPosition}\nFaits connus : ${data.known.join(" ; ")}\nSuppositions : ${data.assumed.join(" ; ")}`;
    const prompt = data.task === "lecture"
      ? `${ctx}\n\nSépare la situation. Réponds en JSON : {"known":[faits établis par le signal],"assumed":[hypothèses],"unknown":[questions ouvertes],"stake":"enjeu en 1-2 phrases"}. 2 à 4 éléments par liste, phrases courtes, en français.`
      : `${ctx}\n\nOptions : ${data.options.join(", ")}. Voix : ${data.voices.map((v) => `${v.id} (${v.label})`).join(", ")}.\nPour chaque option, écris 1 objection sévère par voix. Indique si elle est étayée par un fait connu (support:"etayee"), seulement par une supposition ("reformulee") ou par rien ("non"), et la prémisse. JSON : {"objections":[{"option":"...","voice":"id","text":"...","support":"etayee|reformulee|non","premise":"..."}]}. En français.`;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: "Tu es Contre-feu, un contradicteur rigoureux pour équipes produit. Tu ne prends pas la décision." }, { role: "user", content: prompt }],
        }),
      });
      if (!r.ok) { console.error("OpenAI", r.status, await r.text()); return { result: "", error: r.status === 401 ? "La clé OpenAI est refusée." : r.status === 429 ? "Limite OpenAI atteinte, réessayez plus tard." : "L’IA n’a pas répondu." }; }
      const j = await r.json();
      return { result: String(j.choices[0].message.content) };
    } catch (e) {
      console.error(e);
      return { result: "", error: "L’IA n’a pas pu produire une réponse complète." };
    }
  });
