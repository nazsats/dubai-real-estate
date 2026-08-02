"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live speech-to-text via the browser's Web Speech API.
 *
 * Costs nothing, needs no API key, and streams interim results while the user
 * is still talking — which a server-side model physically cannot do, because
 * it needs the finished audio clip before it can transcribe anything.
 *
 * Availability: Chrome, Edge, and Safari implement it. Firefox does not, so
 * `supported` is exposed and callers must keep the keyboard path working.
 *
 * Privacy note worth knowing: Chrome streams the audio to Google's servers for
 * recognition. It's free and keyless, but it is not on-device.
 */

// Not in the DOM lib's default types.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Human-readable causes for the API's terse error codes. */
const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's address bar.",
  "service-not-allowed": "Speech recognition was blocked by the browser or an extension.",
  network: "Speech recognition needs a network connection.",
  "audio-capture": "No microphone found.",
  aborted: "",
  "no-speech": "",
};

export interface UseSpeech {
  supported: boolean;
  listening: boolean;
  /** Text confirmed by the recogniser. */
  transcript: string;
  /** Words still being revised as the user speaks — render these greyed. */
  interim: string;
  error: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeech(lang = "en-US"): UseSpeech {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  // Distinguishes "the engine stopped on its own" from "the user pressed stop".
  // Chrome ends the session after a pause even with continuous = true, so
  // without this the mic would silently die mid-sentence.
  const wantListening = useRef(false);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let finalChunk = "";
      let pending = "";
      // Only walk results from resultIndex — earlier ones were already handled,
      // and re-reading them duplicates text into the transcript.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalChunk += r[0].transcript;
        else pending += r[0].transcript;
      }
      if (finalChunk) {
        setTranscript((t) => (t ? `${t} ${finalChunk.trim()}` : finalChunk.trim()));
      }
      setInterim(pending);
    };

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are normal during a pause — surfacing them
      // would flash an error every time the user stops to think.
      const msg = ERRORS[e.error] ?? `Speech recognition error: ${e.error}`;
      if (msg) {
        setError(msg);
        wantListening.current = false;
        setListening(false);
      }
    };

    rec.onend = () => {
      setInterim("");
      if (wantListening.current) {
        // Auto-restart: the engine stopped on its own, the user hasn't.
        try {
          rec.start();
        } catch {
          wantListening.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recognition.current = rec;
    return () => {
      wantListening.current = false;
      rec.onresult = rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recognition.current;
    if (!rec || wantListening.current) return;
    setError("");
    wantListening.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      // start() throws InvalidStateError if the engine is already running —
      // harmless, the session we want is live either way.
    }
  }, []);

  const stop = useCallback(() => {
    wantListening.current = false;
    setListening(false);
    try {
      recognition.current?.stop();
    } catch {
      /* not running */
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
