"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceAccess } from "@/lib/context";
import {
  revokeCredential,
  rotateCredential,
  saveCredential,
} from "@/lib/credentials";
import { testProviderConnection } from "@/lib/gateway";
import { isProvider } from "@/lib/providers";
import { canManageKeys } from "@/lib/workspace-access";

export type ActionState = { error?: string; message?: string } | null;

async function gate(slug: string) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok") {
    return { error: "You cannot open keys for this workspace." } as const;
  }
  if (!canManageKeys(access.ctx.role)) {
    return { error: "Only an owner or admin can change provider keys." } as const;
  }
  return { ctx: access.ctx } as const;
}

function providerFrom(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!isProvider(provider)) return null;
  return provider;
}

export async function saveKeyAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate(slug);
  if ("error" in access) return { error: access.error };
  const provider = providerFrom(formData);
  if (!provider) return { error: "Choose a provider." };
  const saved = await saveCredential(
    access.ctx.orgId,
    access.ctx.userId,
    provider,
    String(formData.get("secret") ?? ""),
  );
  if (!saved.ok) return { error: saved.error };
  revalidatePath(`/${slug}/settings/keys`);
  return { message: `Key stored. Hint ${saved.hint}.` };
}

export async function rotateKeyAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate(slug);
  if ("error" in access) return { error: access.error };
  const provider = providerFrom(formData);
  if (!provider) return { error: "Choose a provider." };
  const rotated = await rotateCredential(
    access.ctx.orgId,
    provider,
    String(formData.get("secret") ?? ""),
  );
  if (!rotated.ok) return { error: rotated.error };
  revalidatePath(`/${slug}/settings/keys`);
  return { message: `Key rotated. Hint ${rotated.hint}.` };
}

export async function revokeKeyAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate(slug);
  if ("error" in access) return { error: access.error };
  const provider = providerFrom(formData);
  if (!provider) return { error: "Choose a provider." };
  const revoked = await revokeCredential(access.ctx.orgId, provider);
  if (!revoked.ok) return { error: revoked.error };
  revalidatePath(`/${slug}/settings/keys`);
  return { message: "Key revoked. It will not be used." };
}

export async function testKeyAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await gate(slug);
  if ("error" in access) return { error: access.error };
  const provider = providerFrom(formData);
  if (!provider) return { error: "Choose a provider." };
  const result = await testProviderConnection(access.ctx.orgId, provider);
  if (!result.ok) return { error: result.error };
  return { message: "Provider accepted the key." };
}
