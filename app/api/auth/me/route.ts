// GET /api/auth/me: the logged-in person's profile (or null).
import { getMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ me: await getMe(request) });
}
