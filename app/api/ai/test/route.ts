// POST /api/ai/test: send a prompt (and optional image) to the chosen model.
// Returns the raw answer and how long it took. Used by the /test-ai page.
import { runAi, pickProvider, modelFor, errorText } from "@/lib/ai";
import { getMe, notAllowed } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await getMe())) return notAllowed();
  const body = await request.json();
  const provider = pickProvider(body.provider);
  const started = Date.now();

  try {
    const text = await runAi({
      system: "You are a helpful assistant. Answer briefly.",
      prompt: String(body.prompt ?? ""),
      images: body.image ? [body.image] : [],
      provider,
    });
    return Response.json({ text, provider, model: modelFor(provider), ms: Date.now() - started });
  } catch (err) {
    return Response.json(
      { error: errorText(err), provider, model: modelFor(provider), ms: Date.now() - started },
      { status: 500 }
    );
  }
}
