type ClarifyOut = {
  needs_more_info: boolean;
  ask?: Array<{ id: "scope"|"parties"|"actions"|"timeframe"; q: string }>;
  clarified_question?: string;
  hints?: { scope?: string; parties?: string; actions?: string; timeframe?: { from?: string; to?: string } };
  confidence: number;
};

function sanitizeLLMJson(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // 1) taie code fences ``` / ```json
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }

  // 2) extrage doar blocul { ... } cel mai exterior
  const first = s.indexOf("{");
  const last  = s.lastIndexOf("}");
  if (first !== -1 && last > first) {
    s = s.slice(first, last + 1).trim();
  }
  return s;
}

export async function clarifyQuestion(originalQuestion: string, summary: string): Promise<ClarifyOut> {
  const messages = [
    {
      role: "system",
      content:
        `Ești un asistent de clarificare. Scop: stabilește dacă lipsesc informații critice:
         1) scop, 2) părți, 3) acțiuni, 4) interval.
         Dacă lipsesc → MAX 3 întrebări (id: scope|parties|actions|timeframe).
         Dacă NU lipsesc → "clarified_question" (o frază).
         Răspunde STRICT JSON cu cheile: 
         {"needs_more_info": boolean, "ask": [{"id":"scope","q":"..."}], "clarified_question":"...", 
          "hints":{"scope":"...","parties":"...","actions":"...","timeframe":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}}, "confidence":0.0 }`
    },
    {
      role: "user",
      content: summary
        ? `Rezumat:\n${summary}\n\nÎntrebare:\n${originalQuestion}`
        : `Întrebare:\n${originalQuestion}`
    },
  ];

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", messages, temperature: 0.1 })
  });

  // fallback sigur dacă API-ul eșuează
  if (!resp.ok) {
    console.error("DeepSeek not ok");
    return { needs_more_info: false, clarified_question: originalQuestion, confidence: 0 };
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = sanitizeLLMJson(content);

  try {
    const out = JSON.parse(cleaned) as ClarifyOut;

    // sanity checks minimale
    if (typeof out.needs_more_info !== "boolean") throw new Error("missing needs_more_info");
    if (out.needs_more_info && (!out.ask || out.ask.length === 0)) {
      // dacă zice că are nevoie de clarificări dar nu dă întrebări, nu blocăm fluxul
      return { needs_more_info: false, clarified_question: originalQuestion, confidence: 0.2 };
    }
    return out;
  } catch (e) {
    console.warn("Parse clarify failed. Raw content:", content, e);
    return { needs_more_info: false, clarified_question: originalQuestion, confidence: 0.1 };
  }
}
