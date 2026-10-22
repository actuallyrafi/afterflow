import eventContextJson from "../event-context.json";
import {
  allowedNextSteps,
  quotesBothFreeTexts,
  templateMatchCopy,
  type EventContext,
  type SurveyQuote,
} from "./next-step";
import type { Profile } from "./store";

const eventContext = eventContextJson as EventContext;

export type Explanation = { explanation: string; firstAction: string };

export function toQuote(profile: Profile): SurveyQuote {
  return {
    name: profile.name,
    role: profile.role,
    offers: profile.offers,
    topOffer: profile.topOffer,
    needs: profile.needs,
    topNeed: profile.topNeed,
    availability: profile.availability,
    tryingTo: profile.tryingTo,
  };
}

export const LLM_TIMEOUT_MS = 4000;

export function llmConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const openai = process.env.LLM_API_KEY;
  const xai = process.env.XAI_API_KEY;
  const apiKey = openai || xai;
  if (!apiKey) return null;
  const baseUrl = (
    process.env.LLM_BASE_URL || (openai ? "https://api.openai.com/v1" : "https://api.x.ai/v1")
  ).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || (openai ? "gpt-4o-mini" : "grok-3");
  return { apiKey, baseUrl, model };
}

function fallback(a: Profile, b: Profile): Explanation {
  return templateMatchCopy(toQuote(a), toQuote(b), eventContext);
}

function extractJson(text: string): { explanation?: unknown; next_step?: unknown } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as { explanation?: unknown; next_step?: unknown };
  } catch {
    return null;
  }
}

export async function explainMatch(a: Profile, b: Profile): Promise<Explanation> {
  const safe = fallback(a, b);
  const cfg = llmConfig();
  if (!cfg) return safe;
  const allowed = allowedNextSteps(eventContext);
  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              "You explain why two hackathon attendees should talk.",
              "Use only person_a, person_b, and event_context. Do not invent employers, projects, or traits.",
              "Quote person_a.tryingTo and person_b.tryingTo word for word, each inside straight double quotes.",
              "Never include contact details.",
              "next_step must be copied exactly from allowed_next_steps. Choose exactly one.",
              'Return JSON only: {"explanation":"...","next_step":"..."}',
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              person_a: toQuote(a),
              person_b: toQuote(b),
              event_context: eventContext,
              allowed_next_steps: allowed,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return safe;
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") return safe;
    const parsed = extractJson(text);
    const explanation = typeof parsed?.explanation === "string" ? parsed.explanation.trim() : "";
    const firstAction = typeof parsed?.next_step === "string" ? parsed.next_step.trim() : "";
    if (!quotesBothFreeTexts(explanation, a.tryingTo, b.tryingTo)) return safe;
    if (!allowed.includes(firstAction)) return safe;
    if (explanation.length < 20 || explanation.length > 1600) return safe;
    if (explanation.includes(a.contact) || explanation.includes(b.contact)) return safe;
    if (firstAction.includes(a.contact) || firstAction.includes(b.contact)) return safe;
    return { explanation, firstAction };
  } catch {
    return safe;
  }
}
