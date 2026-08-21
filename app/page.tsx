"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const [docText, setDocText] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(false);

  const isLoading = status === "streaming" || status === "submitted";

  async function handleIndex() {
    if (!docText.trim()) return;
    setIndexing(true);
    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: docText, source: "manual" }),
      });
      const data = await res.json();
      console.log(`Indexados ${data.chunks} chunks`);
      setIndexed(true);
    } catch (err) {
      console.error("Error indexando:", err);
    } finally {
      setIndexing(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">RAG Chat</h1>

      {/* Panel de indexación */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-600">
          1. Pega un documento para indexar
        </p>
        <textarea
          className="w-full h-32 border rounded p-2 text-sm"
          placeholder="Pega aquí el texto del documento..."
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
        />
        <button
          onClick={handleIndex}
          disabled={indexing || indexed}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {indexing ? "Indexando..." : indexed ? "✓ Indexado" : "Indexar"}
        </button>
      </div>

      {/* Historial de mensajes */}
      <div className="border rounded-lg p-4 h-80 overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm">
            Indexa un documento y luego haz preguntas...
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
              Pensando...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Haz una pregunta sobre el documento..."
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          // disabled={isLoading || !indexed}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}