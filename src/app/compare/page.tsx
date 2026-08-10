import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ComparisonWorkspace } from "@/components/ComparisonWorkspace";
import { getSessionUser } from "@/lib/auth/server";

export default async function ComparePage() {
  const username = await getSessionUser();
  if (!username) redirect("/signin");

  return (
    <>
      <AppHeader username={username} active="compare" />
      <main className="pt-16 min-h-screen bg-surface">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-12 flex flex-col gap-12">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-primary">
              Compare companies
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl">
              Line up two or three full research briefs side by side.
            </p>
          </div>

          <ComparisonWorkspace />
        </div>
      </main>
    </>
  );
}
