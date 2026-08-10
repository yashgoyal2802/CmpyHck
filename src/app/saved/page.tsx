import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SavedList } from "@/components/SavedList";
import { getSessionUser } from "@/lib/auth/server";
import { getStorage } from "@/lib/storage";

export default async function SavedPage() {
  const username = await getSessionUser();
  if (!username) redirect("/signin");

  const entries = await getStorage().listOrganizerEntries(username);
  const saved = entries.filter((e) => e.bookmarked);

  return (
    <>
      <AppHeader username={username} active="saved" />
      <main className="pt-16 min-h-screen bg-surface">
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

          <SavedList initialEntries={saved} />
        </div>
      </main>
    </>
  );
}
