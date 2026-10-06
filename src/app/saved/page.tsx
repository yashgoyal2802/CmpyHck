import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SavedList } from "@/components/SavedList";
import { getSessionAccount } from "@/lib/auth/server";
import { DEMO_ORGANIZER_ENTRIES } from "@/lib/demo/organizerFixtures";
import { getStorage } from "@/lib/storage";

export default async function SavedPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/signin");

  // Frozen demo pipeline (add-demo-mode): Acme Consulting is the one
  // bookmarked entry, so this page shows exactly it, without ever reading
  // or writing real per-account organizer storage. See organizerFixtures.ts.
  const saved = account.isDemo
    ? DEMO_ORGANIZER_ENTRIES.filter((e) => e.bookmarked)
    : (await getStorage().listOrganizerEntries(account.username)).filter((e) => e.bookmarked);

  return (
    <>
      <AppHeader username={account.username} role={account.role} active="saved" isDemo={account.isDemo} />
      <main className={`${account.isDemo ? "pt-24" : "pt-16"} min-h-screen bg-surface`}>
        <div className="max-w-container-max mx-auto px-4 md:px-6 py-12 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-primary">
              Saved companies
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl">
              Quick access to companies you have bookmarked — reopening one reuses
              its cached research when it is still fresh.
            </p>
          </div>

          <SavedList initialEntries={saved} isDemo={account.isDemo} />
        </div>
      </main>
    </>
  );
}
