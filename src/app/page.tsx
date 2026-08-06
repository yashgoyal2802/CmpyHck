import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefWorkspace } from "@/components/BriefWorkspace";
import { endSession, getSessionUser } from "@/lib/auth/server";

/**
 * The first screen is the working app, not a landing page: input, research
 * state, brief. This tool is used repeatedly across a placement season, so the
 * search box is what should be on screen when it opens.
 *
 * Middleware already gates this route; the check here is defence in depth.
 */
export default async function HomePage() {
  const username = await getSessionUser();
  if (!username) redirect("/signin");

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Placement Brief</h1>
          <p>Interview preparation research, sourced and sector-aware.</p>
        </div>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link href="/organizer">Organizer</Link>
          <Link href="/compare">Compare</Link>
          <form
            action={async () => {
              "use server";
              await endSession();
              redirect("/signin");
            }}
          >
            <button type="submit" className="secondary">
              Sign out ({username})
            </button>
          </form>
        </nav>
      </header>

      <BriefWorkspace />
    </main>
  );
}
