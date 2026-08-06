import Link from "next/link";
import { redirect } from "next/navigation";
import { ComparisonWorkspace } from "@/components/ComparisonWorkspace";
import { getSessionUser } from "@/lib/auth/server";

export default async function ComparePage() {
  const username = await getSessionUser();
  if (!username) redirect("/signin");

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Compare companies</h1>
          <p>See two or three briefs side by side.</p>
        </div>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link href="/">Search</Link>
          <Link href="/organizer">Organizer</Link>
        </nav>
      </header>

      <ComparisonWorkspace />
    </main>
  );
}
