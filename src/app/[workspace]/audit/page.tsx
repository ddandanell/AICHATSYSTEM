import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata = { title: "Audit" };

export default function AuditPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-2xl font-medium tracking-tight">Audit</h2>
      <Alert>
        <AlertTitle>No separate audit log</AlertTitle>
        <AlertDescription>
          This slice does not keep a second audit trail. The decision record and
          the feedback event are the system of record.
        </AlertDescription>
      </Alert>
    </div>
  );
}
