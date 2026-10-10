// Browser-only helper: remember the Gemma / Gemini choice from the header switch.
export type Provider = "gemma" | "gemini";
const KEY = "aiProvider";

export function getProvider(): Provider {
  try {
    return localStorage.getItem(KEY) === "gemini" ? "gemini" : "gemma";
  } catch {
    return "gemma";
  }
}

export function setProvider(p: Provider) {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    // ignore (private browsing)
  }
}
