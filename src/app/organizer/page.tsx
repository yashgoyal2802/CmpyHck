import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { OrganizerBoard } from "@/components/OrganizerBoard";
import { getSessionAccount } from "@/lib/auth/server";
import { getStorage } from "@/lib/storage";

export default async function OrganizerPage() {
  const account = await getSessionAccount();
  if (!account) redirect("/signin");

  const entries = await getStorage().listOrganizerEntries(account.username);

  return (
    <>
      <AppHeader username={account.username} role={account.role} active="organizer" />
      <main className="pt-16 min-h-screen bg-surface relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
          <div className="absolute -top-64 -right-64 w-96 h-96 bg-primary opacity-5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-32 w-72 h-72 bg-secondary opacity-10 rounded-full blur-2xl" />
        </div>
        <div className="max-w-container-max mx-auto px-4 md:px-6 py-10 flex flex-col gap-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h1 className="text-5xl font-extrabold text-primary mb-2">Your Pipeline</h1>
              <p className="text-lg text-on-surface-variant max-w-2xl">
                Preparation status, interview dates, and confidence — private to you.
              </p>
            </div>
            <Link
              href="/"
              className="bg-primary text-on-primary hover:-translate-y-1 hover:shadow-xl px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-md flex items-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
              Research a company
            </Link>
          </div>

          <OrganizerBoard initialEntries={entries} />
        </div>
      </main>
    </>
  );
}
