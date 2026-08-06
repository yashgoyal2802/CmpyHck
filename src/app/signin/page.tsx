import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/server";
import { isAuthConfigured, verifyPassphrase } from "@/lib/auth/session";

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>) {
  const { error } = await searchParams;
  const configured = isAuthConfigured(process.env);

  async function submit(formData: FormData) {
    "use server";

    const submitted = formData.get("passphrase");
    const ok = await verifyPassphrase(
      typeof submitted === "string" ? submitted : undefined,
      process.env.ACCESS_PASSPHRASE,
    );

    // One generic failure message: distinguishing "wrong passphrase" from
    // "not configured" would tell an outsider which one to keep guessing at.
    if (!ok) redirect("/signin?error=1");

    await startSession();
    redirect("/");
  }

  return (
    <main className="page">
      <div className="signin">
        <h1>Placement Brief</h1>
        <p style={{ color: "var(--muted)" }}>
          Company research briefs for MBA placement interview preparation.
        </p>

        {error && (
          <p className="notice" style={{ textAlign: "left" }} role="alert">
            That passphrase was not accepted.
          </p>
        )}

        {!configured && (
          <p className="notice" style={{ textAlign: "left" }}>
            Access is not configured. Set <code>ACCESS_PASSPHRASE</code> and{" "}
            <code>AUTH_SECRET</code>, then restart.
          </p>
        )}

        <form action={submit} style={{ marginTop: "1.5rem" }}>
          <label htmlFor="passphrase" className="sr-only">
            Access passphrase
          </label>
          <div className="search">
            <input
              id="passphrase"
              name="passphrase"
              type="password"
              autoComplete="current-password"
              placeholder="Access passphrase"
              required
            />
            <button type="submit">Enter</button>
          </div>
        </form>

        <p className="copy-note" style={{ marginTop: "1.5rem" }}>
          Access is limited to people who have the passphrase.
        </p>
      </div>
    </main>
  );
}
