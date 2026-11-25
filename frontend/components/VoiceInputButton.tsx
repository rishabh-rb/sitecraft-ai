"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string; confidence: number };
  }>;
  resultIndex?: number;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function VoiceInputButton({
  onTranscript,
  disabled = false
}: {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const activeRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleListening() {
    if (disabled || !supported) return;
    if (listening) {
      activeRef.current = false;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    activeRef.current = true;
    setMessage("");
    recognition.onresult = (event) => {
      const startIndex = event.resultIndex ?? 0;
      const finalTranscript = Array.from({ length: event.results.length - startIndex }, (_, offset) => {
        const index = startIndex + offset;
        const result = event.results[index];
        return result?.isFinal ? result[0]?.transcript ?? "" : "";
      }).join(" ").trim();
      if (finalTranscript) onTranscript(finalTranscript);
    };
    recognition.onend = () => {
      if (!activeRef.current) {
        setListening(false);
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          setListening(false);
          activeRef.current = false;
          setMessage("Microphone stopped. Tap the button to try again.");
        }
      }, 150);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        activeRef.current = false;
        setListening(false);
        setMessage("Microphone permission is blocked. Allow microphone access in your browser settings.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setMessage("Voice recognition had a problem. Please try again.");
      }
    };
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      activeRef.current = false;
      setListening(false);
      setMessage("Unable to start the microphone. Check browser permissions.");
    }
  }

  if (!supported) return <p className="text-[11px] text-ink/50">Voice input is not supported in this browser.</p>;

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={listening ? "Stop recording" : "Speak your prompt"}
        aria-label={listening ? "Stop recording" : "Speak your prompt"}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${
          listening
            ? "border-red-300 bg-red-50 text-red-600 shadow-[0_0_0_4px_rgba(239,68,68,.1)]"
            : "border-line bg-white text-ink/60 hover:border-accent hover:text-accent"
        } disabled:pointer-events-none disabled:opacity-40`}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      {message ? <span className="ml-2 max-w-56 text-[11px] text-red-600">{message}</span> : null}
    </span>
  );
}
