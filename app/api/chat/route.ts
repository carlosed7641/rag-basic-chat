import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { retrieve } from "@/lib/indexer";
import { Langfuse } from "langfuse";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function toModelMessages(uiMessages: any[]) {
  return uiMessages.map((msg) => {
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.parts)) {
      text = msg.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("");
    }
    return { role: msg.role, content: text };
  });
}

export async function POST(req: Request) {
  const langfuse = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    baseUrl: process.env.LANGFUSE_BASEURL,
    flushAt: 1,      // envía cada evento inmediatamente sin esperar batch
    flushInterval: 0, // sin intervalo de espera
  });

  const body = await req.json();
  const uiMessages = body.messages;
  const lastMessage = uiMessages[uiMessages.length - 1];
  const queryText =
    lastMessage.parts?.find((p: any) => p.type === "text")?.text ??
    lastMessage.content ??
    "";

  const trace = langfuse.trace({
    name: "rag-chat",
    input: queryText,
  });

  const retrievalSpan = trace.span({
    name: "retrieve-chunks",
    input: queryText,
  });

  const context = await retrieve(queryText);
  const contextText = context
    .map((c: any, i: number) => `[Fuente ${i + 1}]:\n${c.content}`)
    .join("\n\n");

  retrievalSpan.end({
    output: { chunksFound: context.length },
  });

  const generation = trace.generation({
    name: "claude-response",
    model: "claude-sonnet-4-6",
    input: queryText,
  });

  const modelMessages = toModelMessages(uiMessages);

  // Flush antes del stream para asegurar que el trace llegue
  await langfuse.flushAsync();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `Eres un asistente de documentacion. Responde UNICAMENTE basandote en el contexto proporcionado.
Si la respuesta no esta en el contexto, di: "No encontre informacion sobre eso en los documentos."
Cita siempre la fuente usando [Fuente N].

<contexto>
${contextText}
</contexto>`,
    messages: modelMessages,
    onFinish: async ({ text, usage }) => {
      generation.end({
        output: text,
        usage: {
          input: usage.inputTokens,
          output: usage.outputTokens,
        },
      });
      trace.update({ output: text });
      await langfuse.flushAsync();
    },
  });

  return result.toUIMessageStreamResponse();
}