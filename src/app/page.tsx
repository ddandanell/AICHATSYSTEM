import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMyWorkspaces } from "@/lib/workspace-access";

export default async function HomePage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const workspaces = await listMyWorkspaces(session.user.id);
  if (workspaces.length === 0) redirect("/onboarding");
  redirect(`/${workspaces[0].slug}/inbox`);
}
