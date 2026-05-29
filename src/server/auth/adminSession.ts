import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, requireAdminPin } from "@/server/config/env";

const cookieName = "fcc_admin";

function secret() {
  return new TextEncoder().encode(env.SESSION_SECRET ?? "dev-session-secret-change-me");
}

export async function verifyAdminPin(pin: string) {
  return pin === requireAdminPin();
}

export async function createAdminSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(cookieName);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return false;
  try {
    const verified = await jwtVerify(token, secret());
    return verified.payload.role === "admin";
  } catch {
    return false;
  }
}
