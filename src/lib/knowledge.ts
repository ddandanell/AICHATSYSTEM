/**
 * Reads local and Neon knowledge for the knowledge pages. Do not auto-send.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type KnowledgeDoc = {
  id: string;
  type: string;
  owner: string;
  status: string;
  effectiveFrom: string;
  dependsOn: string[];
  referencedBy: string[];
  scope: string;
  priority: string;
  title: string;
  body: string;
  kind: "position" | "playbook";
};

function parseFrontmatter(raw: string): {
  data: Record<string, string | string[]>;
  body: string;
} {
  if (!raw.startsWith("---")) throw new Error("knowledge file is missing frontmatter");
  const end = raw.indexOf("\n---", 3);
  if (end === -1) throw new Error("knowledge frontmatter is not closed");
  const frontmatter = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const data: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of frontmatter.split("\n")) {
    if (line.startsWith("  - ") && listKey) {
      const current = data[listKey];
      if (Array.isArray(current)) current.push(line.slice(4).trim());
      continue;
    }
    const match = line.match(/^([a-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim();
    if (value === "[]" || value === "") {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = value.replace(/^['"]|['"]$/g, "");
      listKey = null;
    }
  }
  return { data, body };
}

function titleFrom(body: string, id: string): string {
  const heading = body.split("\n").find((line) => line.startsWith("# "));
  return heading ? heading.slice(2).trim() : id;
}

function readDir(folder: string, kind: KnowledgeDoc["kind"]): KnowledgeDoc[] {
  const dir = join(process.cwd(), "knowledge", folder);
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(dir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      const id = String(data.id ?? file.replace(/\.md$/, ""));
      const dependsOn = Array.isArray(data.depends_on) ? data.depends_on : [];
      const referencedBy = Array.isArray(data.referenced_by)
        ? data.referenced_by
        : [];
      return {
        id,
        type: String(data.type ?? kind),
        owner: String(data.owner ?? ""),
        status: String(data.status ?? ""),
        effectiveFrom: String(data.effective_from ?? ""),
        dependsOn,
        referencedBy,
        scope: String(data.scope ?? ""),
        priority: String(data.priority ?? ""),
        title: titleFrom(body, id),
        body,
        kind,
      };
    });
}

export function listKnowledge(): KnowledgeDoc[] {
  return [...readDir("positions", "position"), ...readDir("playbooks", "playbook")];
}

export function getKnowledge(id: string): KnowledgeDoc | undefined {
  return listKnowledge().find((doc) => doc.id === id);
}
