/**
 * Auto-pilot switch. Default OFF. Recording a candidate never sends.
 * Docs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import { saveAutopilotAction } from "@/app/[workspace]/settings/autopilot/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWorkspaceAccess } from "@/lib/context";
import { readAutopilot } from "@/lib/autopilot";
import { canManageKeys } from "@/lib/workspace-access";

export const metadata = { title: "Auto-pilot" };
export const instant = false;

export default async function AutopilotPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/autopilot">) {
  const { workspace } = await params;
  const query = await searchParams;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const settings = await readAutopilot();
  const manage = canManageKeys(access.ctx.role);
  const error = typeof query.error === "string" ? query.error : "";
  const saved = query.saved === "1";

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Auto-pilot</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Off by default. While it is off, every draft stays pending. If you turn it on,
          a draft can be marked auto_sent_candidate only when its confidence is at least
          the threshold and it does not need a person. That mark does not send a message.
        </p>
      </div>
      {settings.enabled ? (
        <Alert>
          <AlertTitle>Sending is not connected.</AlertTitle>
          <AlertDescription>
            Auto-pilot can record a candidate. It cannot deliver the reply.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Automatic sending is not on</AlertTitle>
          <AlertDescription>Every draft stays pending until a person reviews it.</AlertDescription>
        </Alert>
      )}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>
            {settings.enabled
              ? "Auto-pilot is on. Sending is not connected."
              : "Auto-pilot is off. Drafts stay pending."}
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        action={saveAutopilotAction.bind(null, access.ctx.orgSlug)}
        className="flex flex-col gap-4 rounded-xl border p-4"
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            value="on"
            defaultChecked={settings.enabled}
            disabled={!manage}
          />
          Auto-pilot
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confidence threshold
          <Input
            name="threshold"
            type="number"
            min={0}
            max={1}
            step={0.05}
            defaultValue={settings.confidenceThreshold}
            required
            disabled={!manage}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Stored on its own connection row. Provider keys and operators are not changed.
        </p>
        {manage ? (
          <Button type="submit" className="w-fit">
            Save auto-pilot
          </Button>
        ) : null}
      </form>
    </div>
  );
}
