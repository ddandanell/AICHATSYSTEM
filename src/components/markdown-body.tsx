/**
 * Renders stored knowledge markdown. Do not auto-send.
 */
export function MarkdownBody({ source }: { source: string }) {
  const blocks = source
    .replace(/^# .+\n+/, "")
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-4 text-sm leading-6">
      {blocks.map((block) => {
        if (block.startsWith("### ")) {
          return (
            <h3 key={block} className="text-base font-medium">
              {block.slice(4)}
            </h3>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={block} className="text-lg font-medium">
              {block.slice(3)}
            </h2>
          );
        }
        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={block} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={block}>{block}</p>;
      })}
    </div>
  );
}
