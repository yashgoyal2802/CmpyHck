import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getStorage } from "@/lib/storage";

export default async function OrganizerPage() {
  const username = await getSessionUser();
  if (!username) redirect("/signin");

  const entries = await getStorage().listOrganizerEntries(username);

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Your organizer</h1>
          <p>Preparation status, interview dates, and confidence — private to you.</p>
        </div>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link href="/">Search</Link>
          <Link href="/compare">Compare</Link>
        </nav>
      </header>

      {entries.length === 0 ? (
        <p className="status">
          Nothing tracked yet. Search a company and use the tracker on its brief
          to add it here.
        </p>
      ) : (
        <section className="card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Company</th>
                <th>Prepped</th>
                <th>Interview date</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.companyKey}>
                  <td>{entry.resolvedName}</td>
                  <td>{entry.prepped ? "Yes" : "No"}</td>
                  <td>{entry.interviewDate ?? "—"}</td>
                  <td>{entry.confidence ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
