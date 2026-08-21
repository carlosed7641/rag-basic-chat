import { indexDocument } from "@/lib/indexer";

export async function POST(req: Request) {
  const { text, source } = await req.json();
  const count = await indexDocument(text, source);
  return Response.json({ chunks: count });
}