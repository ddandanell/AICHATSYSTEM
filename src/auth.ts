import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findOrCreateUser } from "@/lib/workspace-access";

const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const name = String(credentials?.name ?? "").trim();
        if (!emailPattern.test(email)) return null;
        const user = await findOrCreateUser(email, name || null);
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const row = await findOrCreateUser(user.email, user.name ?? null);
        token.sub = row.id;
        return token;
      }
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
