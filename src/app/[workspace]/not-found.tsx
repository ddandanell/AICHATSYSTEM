import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function NotFound() {
  return (
    <div className="flex flex-col gap-3 py-10">
      <h2 className="text-xl font-medium">Not in this workspace</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        That record is not visible here. A decision from another workspace does
        not open under this session.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
        Back home
      </Link>
    </div>
  );
}
