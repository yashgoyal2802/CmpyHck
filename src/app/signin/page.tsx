import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/server";
import { verifyCredentials } from "@/lib/auth/credentials";
import { isAuthConfigured } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>) {
  const { error } = await searchParams;
  const configured = isAuthConfigured(process.env);

  async function submit(formData: FormData) {
    "use server";

    const username = formData.get("username");
    const password = formData.get("password");
    const ok = await verifyCredentials(
      typeof username === "string" ? username.trim() : undefined,
      typeof password === "string" ? password : undefined,
      getStorage(),
    );

    // One generic failure message: distinguishing "unknown username" from
    // "wrong password" would tell an outsider which one to keep guessing at.
    if (!ok || typeof username !== "string") redirect("/signin?error=1");

    await startSession(username.trim());
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
            That username and password were not accepted.
          </p>
        )}

        {!configured && (
          <p className="notice" style={{ textAlign: "left" }}>
            Access is not configured. Set <code>AUTH_SECRET</code>, provision an
            account, then restart.
          </p>
        )}

        <form action={submit} style={{ marginTop: "1.5rem" }}>
          <label htmlFor="username" className="sr-only">
            Username
          </label>
          <div className="search" style={{ marginBottom: "0.75rem" }}>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Username"
              required
            />
          </div>

          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <div className="search">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              required
            />
            <button type="submit">Enter</button>
          </div>
        </form>

        <p className="copy-note" style={{ marginTop: "1.5rem" }}>
          Access is limited to provisioned accounts. Forgotten password? Ask
          whoever provisioned your account to reset it.
        </p>
      </div>
    </main>
  );
}
