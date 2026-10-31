"use client";
/**
 * Pending and reviewed tabs for the local queue. Do not auto-send.
 */

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function QueueTabs({
  slug,
  status,
}: {
  slug: string;
  status: "pending_review" | "reviewed";
}) {
  const router = useRouter();
  return (
    <Tabs
      value={status}
      onValueChange={(value) => {
        const next = value === "reviewed" ? "reviewed" : "pending";
        router.push(next === "pending" ? `/${slug}/inbox` : `/${slug}/inbox?status=reviewed`);
      }}
    >
      <TabsList>
        <TabsTrigger value="pending_review">Pending</TabsTrigger>
        <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
