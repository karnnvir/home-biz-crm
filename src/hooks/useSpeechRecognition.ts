import { useCallback, useEffect, useRef, useState } from "react";

// Safari/Chrome on iOS/Android expose this under a vendor prefix.
type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition() {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback((onFinal?: (transcript: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Try typing instead.");
      return;
    }
    setError(null);
    setTranscript("");
    transcriptRef.current = "";
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      transcriptRef.current = text;
      setTranscript(text);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Allow it in your browser settings, or type instead."
          : "Didn't catch that — try again or type instead."
      );
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      if (transcriptRef.current.trim()) onFinal?.(transcriptRef.current.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset, setTranscript };
}
