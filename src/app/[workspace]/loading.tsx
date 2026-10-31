import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Spinner />
      Loading this workspace…
    </div>
  );
}
