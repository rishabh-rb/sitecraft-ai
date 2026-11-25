"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";

export function toast(message: string, kind: "success" | "info" = "success") {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("sitecraft-toast", {
        detail: { message, kind, id: Date.now() + Math.random() },
      }),
    );
}
export function ToastViewport() {
  const [messages, setMessages] = useState<
    Array<{ id: number; message: string; kind: string }>
  >([]);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const listener = (event: Event) => {
      const item = (event as CustomEvent).detail;
      setMessages((items) => [...items.slice(-2), item]);
      const timer = setTimeout(() => {
        setMessages((items) => items.filter((value) => value.id !== item.id));
        timers.delete(timer);
      }, 4500);
      timers.add(timer);
    };
    window.addEventListener("sitecraft-toast", listener);
    return () => {
      window.removeEventListener("sitecraft-toast", listener);
      timers.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="sc-toasts" aria-live="polite" aria-atomic="false">
      {messages.map((item) => (
        <div key={item.id} className="sc-toast">
          {item.kind === "success" ? (
            <CheckCircle2 size={19} />
          ) : (
            <Info size={19} />
          )}
          <span>{item.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() =>
              setMessages((items) =>
                items.filter((value) => value.id !== item.id),
              )
            }
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
