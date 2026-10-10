// /intake: a logged-in patient starts a new case. Name and phone are filled in
// from their account (they can change them, e.g. when the case is for a child).
import IntakeForm from "@/components/IntakeForm";
import { requireMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const me = await requireMe("patient");
  return <IntakeForm defaultName={me.name} defaultPhone={me.phone ?? ""} />;
}
