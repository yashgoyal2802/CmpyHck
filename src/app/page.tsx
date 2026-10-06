import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BriefWorkspace } from "@/components/BriefWorkspace";
import { getSessionAccount } from "@/lib/auth/server";

/**
 * The first screen is the working app, not a landing page: input, research
 * state, brief. This tool is used repeatedly across a placement season, so the
 * search box is what should be on screen when it opens.
 *
 * Middleware already gates this route; the check here is defence in depth.
 */
export default async function HomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ company?: string }>;
}>) {
  const account = await getSessionAccount();
  if (!account) redirect("/signin");

  const { company } = await searchParams;

  return (
    <>
      <AppHeader username={account.username} role={account.role} active="search" isDemo={account.isDemo} />
      <main className={`${account.isDemo ? "pt-24" : "pt-16"} min-h-screen bg-surface relative overflow-hidden`}>
        <div
          className="absolute top-0 right-0 w-3/4 h-[600px] bg-gradient-to-bl from-primary-fixed-dim/30 via-transparent to-transparent blur-3xl -z-10 pointer-events-none rounded-bl-full"
          aria-hidden="true"
        />
        <div
          className="absolute top-[200px] left-0 w-1/2 h-[400px] bg-gradient-to-tr from-secondary-fixed/20 via-transparent to-transparent blur-3xl -z-10 pointer-events-none rounded-tr-full"
          aria-hidden="true"
        />
        <div className="max-w-container-max mx-auto px-4 md:px-6 py-16 md:py-[120px] flex flex-col items-center gap-10">
          <div className="flex flex-col items-center text-center max-w-3xl gap-3">
            <h1 className="text-5xl md:text-[48px] font-extrabold tracking-tight text-on-surface leading-[1.1] text-balance">
              Prep smarter,{" "}
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-surface-tint">
                not longer
              </span>
              .
            </h1>
            <p className="text-lg text-on-surface-variant max-w-xl mt-2">
              Sourced, sector-aware company research briefs for MBA placement interviews.
            </p>
          </div>

          <BriefWorkspace initialCompany={company} isDemo={account.isDemo} />
        </div>
      </main>
    </>
  );
}
