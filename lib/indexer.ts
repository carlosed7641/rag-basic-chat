import { pipeline } from "@xenova/transformers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.length > 50);
}

async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export async function indexDocument(text: string, source: string) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    const embedding = await embed(chunk);
    await supabase.from("documents").insert({
      content: chunk,
      embedding,
      metadata: { source },
    });
  }
  return chunks.length;
}

export async function retrieve(query: string, limit = 4) {
  const queryEmbedding = await embed(query);
  const { data } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_threshold: 0.4,
    match_count: limit,
  });
  return data ?? [];
}