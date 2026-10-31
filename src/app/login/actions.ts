"use server";

import { connection } from "next/server";
import { signIn, signOut } from "@/auth";

export async function loginAction(formData: FormData) {
  await connection();
  await signIn("credentials", {
    email: formData.get("email"),
    name: formData.get("name"),
    redirectTo: "/",
  });
}

export async function logoutAction() {
  await connection();
  await signOut({ redirectTo: "/login" });
}
