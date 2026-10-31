"use server";

import { connection } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { usesMychefInbox } from "@/db/mode";

export async function loginAction(formData: FormData) {
  await connection();
  const email = formData.get("email");
  if (usesMychefInbox()) {
    try {
      await signIn("credentials", {
        email,
        password: formData.get("password"),
        redirectTo: "/mychef/inbox",
      });
    } catch (error) {
      if (isRedirectError(error)) throw error;
      if (error instanceof AuthError) redirect("/login?error=1");
      throw error;
    }
    return;
  }
  await signIn("credentials", {
    email,
    name: formData.get("name"),
    redirectTo: "/",
  });
}

export async function logoutAction() {
  await connection();
  await signOut({ redirectTo: "/login" });
}
