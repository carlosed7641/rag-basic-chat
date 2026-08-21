import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { retrieve } from "@/lib/indexer";

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
  try {
    const body = await req.json();
    const uiMessages = body.messages;

    const lastMessage = uiMessages[uiMessages.length - 1];
    const queryText =
      lastMessage.parts?.find((p: any) => p.type === "text")?.text ??
      lastMessage.content ??
      "";

    if (!queryText) {
      return Response.json({ error: "Texto vacio" }, { status: 400 });
    }

    const context = await retrieve(queryText);
    const contextText = context
      .map((c: any, i: number) => `[Fuente ${i + 1}]:\n${c.content}`)
      .join("\n\n");

    // Convertir UIMessage[] a ModelMessage[]
    const modelMessages = toModelMessages(uiMessages);

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: `Eres un asistente de documentacion. Responde UNICAMENTE basandote en el contexto proporcionado.
Si la respuesta no esta en el contexto, di: "No encontre informacion sobre eso en los documentos."
Cita siempre la fuente usando [Fuente N].

<contexto>
${contextText}
</contexto>`,
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("Error en /api/chat:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}