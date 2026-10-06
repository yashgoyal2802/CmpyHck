import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { endSession } from "@/lib/auth/server";
import type { AccountRole } from "@/lib/storage/types";

const NAV_ITEMS = [
  { href: "/", label: "Search", key: "search" },
  { href: "/saved", label: "Saved", key: "saved" },
  { href: "/organizer", label: "Organizer", key: "organizer" },
  { href: "/compare", label: "Compare", key: "compare" },
] as const;

export function AppHeader({
  username,
  active,
  role,
  isDemo = false,
}: {
  username: string;
  active: (typeof NAV_ITEMS)[number]["key"];
  role: AccountRole;
  /** A credential-free demo session - see add-demo-mode. Reaches every page (unlike search_only), so all nav items show; the account menu is replaced with a sign-in link instead of a real username. */
  isDemo?: boolean;
}) {
  // Cosmetic consistency with what middleware actually enforces, not the
  // enforcement itself — see design.md (add-user-roles) §Decision 3. A demo
  // session reaches every page (middleware doesn't restrict it the way
  // search_only is restricted), so it always sees the full nav.
  const visibleNavItems =
    !isDemo && role === "search_only" ? NAV_ITEMS.filter((item) => item.key === "search") : NAV_ITEMS;
  async function signOut() {
    "use server";
    await endSession();
    redirect("/signin");
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 bg-surface/90 backdrop-blur-md shadow-[0_4px_20px_rgba(76,36,112,0.06)]">
      <div className="h-full max-w-container-max mx-auto px-4 md:px-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-xs shadow-[0_4px_20px_rgba(76,36,112,0.06)]">
            SH
          </span>
          <span className="text-2xl font-bold text-primary tracking-tight hidden sm:inline">
            SoHired
          </span>
        </Link>

        <nav className="flex items-center gap-4 md:gap-12 h-full overflow-x-auto">
          {visibleNavItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={`h-full flex items-center px-1 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                active === item.key
                  ? "text-primary border-primary"
                  : "text-on-surface-variant border-transparent hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <ThemeToggle />
          <div className="pl-4 border-l border-outline-variant">
            {isDemo ? (
              <Link
                href="/signin"
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold hover:brightness-95 active:scale-[0.97] transition-[filter,transform]"
              >
                Sign in
              </Link>
            ) : (
              <UserMenu username={username} signOut={signOut} />
            )}
          </div>
        </div>
      </div>

      {isDemo && (
        <div className="absolute top-full inset-x-0 bg-tertiary-fixed text-on-tertiary-fixed text-xs font-semibold text-center py-1.5 px-4">
          You&apos;re browsing a demo — search is limited to a few sample companies, and saving/tracking is disabled.{" "}
          <Link href="/signin" className="underline underline-offset-2 hover:no-underline">
            Sign in
          </Link>{" "}
          for the real thing.
        </div>
      )}
    </header>
  );
}
