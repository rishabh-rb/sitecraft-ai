"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { VoiceInputButton } from "@/components/VoiceInputButton";

type Message = { role: "user" | "assistant"; content: string };

function backendUrl() {
  if (typeof window !== "undefined") return `http://${window.location.hostname}:4000`;
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
}

export function AuraVoiceWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey! I’m AuraVoice AI, your SiteCraft website-building assistant. Ask me about prompts, website design, launch checks, exporting, deployment, or using SiteCraft." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speak(text: string) {
    if (!speaking || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  }

  function toggleSpeaking() {
    setSpeaking((value) => {
      const nextValue = !value;
      if (!nextValue && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return nextValue;
    });
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, startX: position.x, startY: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setPosition({
      x: dragRef.current.startX + event.clientX - dragRef.current.pointerX,
      y: dragRef.current.startY + event.clientY - dragRef.current.pointerY
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl()}/api/aura/chat`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history: messages.slice(-10) })
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) throw new Error(data?.error?.message || "AuraVoice AI is unavailable.");
      const reply = data.data.reply as string;
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (pathname?.startsWith("/builder/")) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AuraVoice AI"
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#302568] to-[#7652b8] text-white shadow-lg shadow-[#302568]/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#302568]/30"
      >
        <Bot className="h-8 w-8" strokeWidth={1.8} />
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-[#f2b84b] text-[#302568]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <section
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      className="fixed bottom-6 right-6 z-50 flex h-[min(650px,calc(100vh-3rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[26px] border border-white/60 bg-white/90 shadow-[0_24px_80px_rgba(38,28,92,.24)] backdrop-blur-xl"
    >
      <div
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex cursor-grab touch-none items-center justify-between bg-gradient-to-r from-[#211c4f] via-[#39246c] to-[#9b4d9d] px-5 py-4 text-white active:cursor-grabbing"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Bot className="h-5 w-5" /></div>
          <div><p className="text-sm font-bold">AuraVoice AI</p><p className="text-[11px] text-white/65">SiteCraft & website help</p></div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleSpeaking} className={`rounded-lg p-2 transition hover:bg-white/15 ${!speaking ? "bg-white/15 text-white/70" : ""}`} aria-pressed={!speaking} aria-label={speaking ? "Mute voice responses" : "Unmute voice responses"} title={speaking ? "Mute voice responses" : "Unmute voice responses"}>{speaking ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 transition hover:bg-white/15" aria-label="Close AuraVoice AI" title="Close AuraVoice AI"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="panel-scroll flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-[#faf8ff] to-white p-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.role === "user" ? "rounded-br-md bg-[#302568] text-white" : "rounded-bl-md border border-[#ece8f8] bg-white text-[#29263d] shadow-sm"}`}>{message.content}</div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-xs text-[#78738f]"><Loader2 className="h-4 w-4 animate-spin" /> AuraVoice is thinking...</div>}
      </div>
      <form onSubmit={submit} className="border-t border-[#eeeaf7] bg-white p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[#e5e0f2] bg-[#faf9fe] p-2 focus-within:border-[#8b6bd9]">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Ask about SiteCraft or your website..."
            aria-label="Message AuraVoice"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[#29263d] outline-none"
            disabled={loading}
          />
          <VoiceInputButton onTranscript={(text) => setInput((current) => current ? `${current.trim()} ${text}` : text)} disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Send message" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#302568] text-white transition hover:bg-[#46358b] disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#9892aa]">Enter for a new line · Ctrl/Cmd + Enter to send · {speaking ? "Voice on" : "Voice muted"}</p>
      </form>
    </section>
  );
}
