import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/server";
import { verifyCredentials } from "@/lib/auth/credentials";
import { isAuthConfigured } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { PasswordField } from "@/components/PasswordField";

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
    <main className="min-h-screen bg-surface grid place-items-center px-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-2 p-8 flex flex-col gap-6 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-primary text-on-primary font-bold text-lg shadow-elevation-1">
            SH
          </span>
          <h1 className="text-2xl font-bold text-primary mt-2">SoHired</h1>
          <p className="text-on-surface-variant text-sm">
            Company research briefs for MBA placement interview preparation.
          </p>
        </div>

        {error && (
          <p className="p-3 rounded-xl bg-error-container text-on-error-container text-sm text-left" role="alert">
            That username and password were not accepted.
          </p>
        )}

        {!configured && (
          <p className="p-3 rounded-xl bg-error-container text-on-error-container text-sm text-left">
            Access is not configured. Set <code>AUTH_SECRET</code>, provision an
            account, then restart.
          </p>
        )}

        <form action={submit} className="flex flex-col gap-3">
          <label htmlFor="username" className="sr-only">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Username"
            required
            className="w-full px-4 py-3 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant text-center focus:bg-surface-container-lowest transition-colors"
          />

          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <PasswordField
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
          />

          <button
            type="submit"
            className="mt-1 px-6 py-3 rounded-full bg-primary text-on-primary font-semibold shadow-elevation-1 hover:brightness-95 hover:shadow-elevation-2 active:scale-[0.97] transition-[filter,box-shadow,transform]"
          >
            Enter
          </button>
        </form>

        <p className="text-on-surface-variant text-xs">
          Access is limited to provisioned accounts. Forgotten password? Ask
          whoever provisioned your account to reset it.
        </p>
      </div>
    </main>
  );
}
