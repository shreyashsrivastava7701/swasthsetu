// The AI layer. Every AI call in the app goes through this file, so the model
// can be switched (Gemma or Gemini) without touching any other file.
// Runs on the server only: the API key is read from environment variables.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { z } from "zod";

export type Provider = "gemma" | "gemini";
export type AiImage = { mimeType: string; base64: string };
export type AiRequest = {
  system: string; // the instructions (rules) for the model
  prompt: string; // the actual input, e.g. what the patient said
  images?: AiImage[]; // optional photos (lab report, X-ray)
  provider?: Provider; // optional override from the header switch
  model?: string; // optional exact model name (used by the backup chain)
  deadline?: number; // time (ms) by which the answer must be in
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models that refused the low-thinking setting (filled in while the app runs).
const NO_THINKING_SETTING = new Set<string>();

// Decide which provider to use: the override if given, otherwise AI_PROVIDER.
export function pickProvider(override?: string): Provider {
  const p = override || process.env.AI_PROVIDER || "gemma";
  return p === "gemini" ? "gemini" : "gemma";
}

// Gemini backups, tried in order when a model is busy:
// GEMINI_MODEL first, then the names in GEMINI_BACKUP_MODELS (comma separated).
export function geminiChain(): string[] {
  const backups = (process.env.GEMINI_BACKUP_MODELS ?? "gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([modelFor("gemini"), ...backups])];
}

export function modelFor(provider: Provider): string {
  return provider === "gemini"
    ? process.env.GEMINI_MODEL || "gemini-flash-latest"
    : process.env.GEMMA_MODEL || "gemma-4-31b-it";
}

// Send one request to the model and return its text answer.
// The system text is put at the top of the prompt instead of using a special
// "system instruction" setting, because that setting may not work for Gemma.
export async function runAi(req: AiRequest): Promise<string> {
  const provider = pickProvider(req.provider);
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Check .env.local.");
  }

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${req.system}\n\n${req.prompt}` },
  ];
  for (const img of req.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  // Give up after AI_TIMEOUT_SECONDS (default 60) so the page never spins forever.
  // On Vercel a request is cut off after 60 s, so also stop at the deadline.
  const seconds = Number(process.env.AI_TIMEOUT_SECONDS || 60);
  const limitMs = Math.min(seconds * 1000, (req.deadline ?? Infinity) - Date.now());
  if (limitMs < 3000) throw new Error("timeout: no time left for this model");
  const model = req.model ?? modelFor(provider);
  const call = (lowThinking: boolean) =>
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        abortSignal: AbortSignal.timeout(limitMs),
        // Less "thinking" = much faster answers. Some models do not accept this
        // setting; then we remember that and call them without it.
        ...(lowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      },
    });

  let response;
  if (NO_THINKING_SETTING.has(model)) {
    response = await call(false);
  } else {
    try {
      response = await call(true);
    } catch (err) {
      if (!/INVALID_ARGUMENT|thinking/i.test(String(err))) throw err;
      NO_THINKING_SETTING.add(model);
      response = await call(false);
    }
  }

  // Join the answer's text parts, skipping any "thinking" parts.
  const answerParts = response.candidates?.[0]?.content?.parts ?? [];
  const text = answerParts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!text) throw new Error(`The ${provider} model returned an empty answer.`);
  return text;
}

// Pull the JSON object out of a model answer: remove ``` fences and keep
// everything from the first { to the last }.
export function extractJson(text: string): unknown {
  const clean = text.replace(/```json|```/gi, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in the answer.");
  return JSON.parse(clean.slice(start, end + 1));
}

// Ask once and check the JSON against the schema. If the answer arrived but
// was not valid JSON, ask once more with a reminder. If the model itself failed
// (busy, timeout, wrong name), do not retry here: the caller moves to Gemini.
async function tryJson<T>(schema: z.ZodType<T>, req: AiRequest): Promise<T> {
  const first = await runAi(req);
  try {
    return schema.parse(extractJson(first));
  } catch {
    const second = await runAi({
      ...req,
      prompt: `${req.prompt}\n\nReturn only valid JSON, no other text.`,
    });
    return schema.parse(extractJson(second));
  }
}

const isBusy = (err: unknown) => /high demand|UNAVAILABLE|503|429|RESOURCE_EXHAUSTED/i.test(String(err));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Run an AI call that must return JSON in a known shape.
// Order tried: the chosen model, then (if AI_AUTO_FALLBACK=true or Gemini was
// chosen) the Gemini backup chain. A busy model gets one more try after 3 s.
// All tries together stop after AI_TOTAL_SECONDS (default 45), so the server
// still has time to save and answer before Vercel's 60 s limit.
export async function runAiJson<T>(
  schema: z.ZodType<T>,
  req: AiRequest
): Promise<{ data: T; provider: Provider }> {
  const provider = pickProvider(req.provider);
  const fallback = process.env.AI_AUTO_FALLBACK === "true";
  const plan: { provider: Provider; model: string }[] =
    provider === "gemma"
      ? [{ provider: "gemma", model: modelFor("gemma") }, ...(fallback ? geminiChain().map((model) => ({ provider: "gemini" as const, model })) : [])]
      : geminiChain().map((model) => ({ provider: "gemini" as const, model }));

  const deadline = Date.now() + Number(process.env.AI_TOTAL_SECONDS || 45) * 1000;
  const errors: string[] = [];
  for (const [i, step] of plan.entries()) {
    // A slow first model may use only part of the time, so the backups still
    // get a turn. The last model may use whatever is left.
    const left = deadline - Date.now();
    const stepDeadline = i < plan.length - 1 ? Date.now() + left * 0.6 : deadline;
    if (left < 5000) {
      errors.push("Out of time.");
      break;
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const data = await tryJson(schema, { ...req, provider: step.provider, model: step.model, deadline: stepDeadline });
        console.log(`[ai] ${step.model} OK in ${Date.now() - started} ms`);
        return { data, provider: step.provider };
      } catch (err) {
        console.error(`[ai] ${step.model} failed after ${Date.now() - started} ms (try ${attempt}):`, String(err).slice(0, 200));
        if (attempt === 1 && isBusy(err) && stepDeadline - Date.now() > 10000) {
          await wait(3000); // busy: wait a moment and try the same model once more
          continue;
        }
        errors.push(`${step.model}: ${errorText(err)}`);
        break; // move on to the next model
      }
    }
  }
  throw new Error(errors.join(" "));
}

// Turn any error into a short readable message.
export function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/high demand|UNAVAILABLE|503/i.test(msg)) return "The model is busy right now. Try again or switch AI.";
  if (/abort|timeout/i.test(msg)) return "The model took too long to answer.";
  return msg;
}
