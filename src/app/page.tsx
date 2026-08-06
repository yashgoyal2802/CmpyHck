import { redirect } from "next/navigation";
import { BriefWorkspace } from "@/components/BriefWorkspace";
import { endSession, hasValidSession } from "@/lib/auth/server";

/**
 * The first screen is the working app, not a landing page: input, research
 * state, brief. This tool is used repeatedly across a placement season, so the
 * search box is what should be on screen when it opens.
 *
 * Middleware already gates this route; the check here is defence in depth.
 */
export default async function HomePage() {
  if (!(await hasValidSession())) redirect("/signin");

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Placement Brief</h1>
          <p>Interview preparation research, sourced and sector-aware.</p>
        </div>
        <form
          action={async () => {
            "use server";
            await endSession();
            redirect("/signin");
          }}
        >
          <button type="submit" className="secondary">
            Sign out
          </button>
        </form>
      </header>

      <BriefWorkspace />
    </main>
  );
}
