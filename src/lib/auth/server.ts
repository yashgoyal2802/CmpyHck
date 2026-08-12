import { cookies } from "next/headers";
import type { AccountRole } from "@/lib/storage/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "./session";

/** Server-side session helpers. Not imported by middleware, which reads the request directly. */

export interface SessionAccount {
  username: string;
  role: AccountRole;
}

/** The signed-in account's identity and role, or null if there is no valid session. */
export async function getSessionAccount(): Promise<SessionAccount | null> {
  const jar = await cookies();
  const session = await verifySessionToken(
    jar.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET,
  );
  return session ? { username: session.username, role: session.role } : null;
}

/** The signed-in account's username, or null if there is no valid session. Most call sites only need this. */
export async function getSessionUser(): Promise<string | null> {
  const account = await getSessionAccount();
  return account?.username ?? null;
}

export async function hasValidSession(): Promise<boolean> {
  return (await getSessionUser()) !== null;
}

export async function startSession(username: string, role: AccountRole): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(secret, username, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
