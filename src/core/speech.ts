/** Text-to-Speech helper for young learners using the Web Speech Synthesis API. */

export type SpeechLanguage = 'vi-VN' | 'en-US';

export interface SpeechOptions {
  lang?: SpeechLanguage;
  rate?: number; // default 0.85 for clear pronunciation for children
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore speech cancel failures in non-compliant environments
  }
}

export function speakText(text: string, options: SpeechOptions = {}): boolean {
  if (!isSpeechSupported() || !text?.trim()) return false;
  try {
    stopSpeaking();
    const UtteranceClass = window.SpeechSynthesisUtterance;
    if (!UtteranceClass) return false;
    const utterance = new UtteranceClass(text.trim());
    utterance.lang = options.lang ?? 'vi-VN';
    utterance.rate = options.rate ?? 0.85;
    utterance.pitch = options.pitch ?? 1.0;

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    options.onError?.(error);
    return false;
  }
}
