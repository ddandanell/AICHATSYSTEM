/**
 * Local hashed embeddings for documents and chunks. Do not auto-send.
 */
export const EMBEDDING_DIM = 256;

const STOP = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length > 1 && !STOP.has(token),
  );
}

// Local hashed embedding. No provider call. Cosine similarity is meaningful
// only after L2 normalization, which is what pgvector <=> expects here.
export function embedText(text: string): number[] {
  const vector = new Float64Array(EMBEDDING_DIM);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const hash = hashToken(token);
    vector[hash % EMBEDDING_DIM] += (hash & 0x100) === 0 ? 1 : -1;
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const hash = hashToken(`${tokens[index]}_${tokens[index + 1]}`);
    vector[hash % EMBEDDING_DIM] += ((hash & 0x100) === 0 ? 1 : -1) * 0.5;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) {
    vector[0] = 1;
    return Array.from(vector);
  }
  return Array.from(vector, (value) => value / norm);
}

export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIM) {
    throw new Error(`embedding must be ${EMBEDDING_DIM} dimensions`);
  }
  const parts = values.map((value) => {
    if (!Number.isFinite(value)) throw new Error("embedding value must be finite");
    return value.toFixed(8);
  });
  return `[${parts.join(",")}]`;
}

export function chunkBody(title: string, body: string): string[] {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > 700 && current) {
      pieces.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }
  if (current) pieces.push(current);
  if (pieces.length === 0) pieces.push(body.trim() || title);
  return pieces.map((piece) => `${title}\n\n${piece}`);
}
