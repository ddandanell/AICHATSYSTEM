import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";

const ROOT = join(process.cwd(), "data", "raw", "mychef");
const MAX_BYTES = 8 * 1024 * 1024;
const TEXT = /\.(md|markdown|txt|json|html|csv)$/i;

export type ArchiveFile = {
  name: string;
  bytes: number;
  text: boolean;
};

export type ArchiveRecord = {
  id: string;
  filename: string;
  bytes: number;
  storedAt: string;
  files: ArchiveFile[];
  knowledgeId: string | null;
};

function indexPath() {
  return join(ROOT, "index.json");
}

async function readIndex(): Promise<ArchiveRecord[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw) as ArchiveRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(rows: ArchiveRecord[]) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(indexPath(), JSON.stringify(rows, null, 2));
}

export async function listArchives(): Promise<ArchiveRecord[]> {
  const rows = await readIndex();
  return rows.sort((left, right) => right.storedAt.localeCompare(left.storedAt));
}

export async function readArchiveText(id: string): Promise<string> {
  const folder = join(ROOT, id, "files");
  const names = await readdir(folder).catch(() => [] as string[]);
  const parts: string[] = [];
  for (const name of names.sort()) {
    if (!TEXT.test(name) && !name.endsWith(".extract.txt")) continue;
    const text = await readFile(join(folder, name), "utf8");
    parts.push(`# ${name}\n\n${text}`);
    if (parts.join("\n").length > 80_000) break;
  }
  return parts.join("\n\n").slice(0, 80_000);
}

export async function markArchiveCurated(id: string, knowledgeId: string) {
  const rows = await readIndex();
  const next = rows.map((row) => (row.id === id ? { ...row, knowledgeId } : row));
  await writeIndex(next);
}

function safeName(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "file";
}

export async function storeArchive(filename: string, bytes: Uint8Array): Promise<ArchiveRecord> {
  if (bytes.byteLength === 0) throw new Error("The file is empty.");
  if (bytes.byteLength > MAX_BYTES) throw new Error("Keep the export under 8 MB.");
  const id = `import-${randomUUID()}`;
  const folder = join(ROOT, id);
  const filesFolder = join(folder, "files");
  await mkdir(filesFolder, { recursive: true });
  const lower = filename.toLowerCase();
  const files: ArchiveFile[] = [];

  if (lower.endsWith(".zip")) {
    await writeFile(join(folder, "original.zip"), bytes);
    let unpacked: Record<string, Uint8Array>;
    try {
      unpacked = unzipSync(bytes);
    } catch {
      throw new Error("That zip could not be read.");
    }
    const entries = Object.entries(unpacked).filter(([, value]) => value.byteLength > 0).slice(0, 40);
    for (const [name, value] of entries) {
      const stored = safeName(name);
      const isText = TEXT.test(name);
      files.push({ name, bytes: value.byteLength, text: isText });
      if (isText && value.byteLength <= 1_000_000) {
        await writeFile(join(filesFolder, stored), value);
      }
    }
  } else if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    const stored = safeName(filename);
    await writeFile(join(folder, stored), bytes);
    await writeFile(join(filesFolder, stored), bytes);
    files.push({ name: filename, bytes: bytes.byteLength, text: true });
  } else {
    throw new Error("Upload a .zip, .json, or .markdown export.");
  }

  const record: ArchiveRecord = {
    id,
    filename,
    bytes: bytes.byteLength,
    storedAt: new Date().toISOString(),
    files,
    knowledgeId: null,
  };
  const checksum = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  await writeFile(join(folder, "manifest.json"), JSON.stringify({ ...record, checksum }, null, 2));
  const rows = await readIndex();
  rows.push(record);
  await writeIndex(rows);
  return record;
}
