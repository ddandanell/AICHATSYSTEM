/**
 * Login server actions.
 * Neon: email + password against approved operators (hashed only).
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use server";

import { connection } from "next/server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { usesMychefInbox } from "@/db/mode";
import { ensureBootstrapOperator } from "@/lib/operators";

export async function loginAction(formData: FormData) {
  await connection();
  if (usesMychefInbox()) {
    await ensureBootstrapOperator();
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  try {
    await signIn("credentials", {
      email,
      password,
      name,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}

export async function logoutAction() {
  await connection();
  await signOut({ redirectTo: "/login" });
}
