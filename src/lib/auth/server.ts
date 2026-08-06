import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
} from "./session";

/** Server-side session helpers. Not imported by middleware, which reads the request directly. */

export async function hasValidSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionToken(
    jar.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET,
  );
}

export async function startSession(): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(secret), {
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
