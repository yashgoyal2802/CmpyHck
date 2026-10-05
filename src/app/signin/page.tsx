import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth/server";
import { accountRequiresApiKey, verifyCredentials } from "@/lib/auth/credentials";
import { isAuthConfigured } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";
import { PasswordField } from "@/components/PasswordField";
import { SignInMascot } from "@/components/SignInMascot";

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
    const geminiApiKey = formData.get("geminiApiKey");
    const ok = await verifyCredentials(
      typeof username === "string" ? username.trim() : undefined,
      typeof password === "string" ? password : undefined,
      getStorage(),
    );

    // One generic failure message for bad credentials: distinguishing
    // "unknown username" from "wrong password" would tell an outsider which
    // one to keep guessing at. A missing-key failure is a distinct message
    // (see below) - it's not a credential-guessing vector, it only fires
    // once the username and password have already been confirmed correct.
    if (!ok || typeof username !== "string") redirect("/signin?error=1");

    const trimmedUsername = username.trim();
    const account = await getStorage().getAccount(trimmedUsername);
    // verifyCredentials just confirmed this account exists and the password
    // matched, so a missing account here would mean storage changed under
    // us mid-request — fail the same way a bad credential does.
    if (!account) redirect("/signin?error=1");

    const trimmedApiKey = typeof geminiApiKey === "string" ? geminiApiKey.trim() : "";
    if (accountRequiresApiKey(account.role) && trimmedApiKey.length === 0) {
      redirect("/signin?error=key_required");
    }

    await startSession(trimmedUsername, account.role, accountRequiresApiKey(account.role) ? trimmedApiKey : undefined);
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-surface grid place-items-center px-4">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Negative margin pulls the card up to overlap the mascot's lower
            portion; the card's opaque background (relative z-10 over the
            mascot's implicit z-0) covers that portion, so it reads as the
            mascot peeking out from behind the card rather than floating
            above it. 22px is measured against this specific avatar sprite,
            not the padding-heavy pug sprite used earlier: the avatar's face
            and beard fill almost the entire cell (unlike the pug, there's
            barely any transparent margin), with the shirt collar only
            starting around 90% down a 160px (w-40/h-40) box - so the
            overlap needs to be small, just enough to tuck the collar,
            not the chin. */}
        <div className="relative z-0 mb-[-22px]">
          <SignInMascot initialError={error} />
        </div>

        <div className="relative z-10 w-full bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-2 p-8 flex flex-col gap-6 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="grid place-items-center w-12 h-12 rounded-2xl bg-primary text-on-primary font-bold text-lg shadow-elevation-1">
              SH
            </span>
            <h1 className="text-2xl font-bold text-primary mt-2">SoHired</h1>
            <p className="text-on-surface-variant text-sm">
              Company research briefs for MBA placement interview preparation.
            </p>
          </div>

          {error === "key_required" && (
            <p className="p-3 rounded-xl bg-error-container text-on-error-container text-sm text-left" role="alert">
              Enter your Gemini API key to sign in.
            </p>
          )}

          {error && error !== "key_required" && (
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

            <label htmlFor="geminiApiKey" className="sr-only">
              Gemini API key
            </label>
            <PasswordField
              id="geminiApiKey"
              name="geminiApiKey"
              autoComplete="off"
              placeholder="Gemini API key"
              required={false}
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
      </div>
    </main>
  );
}
