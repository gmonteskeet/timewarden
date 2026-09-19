// The browser's own speech recognition (answers) and speech synthesis (questions), in British English.
// Works in Chrome. No key needed.
import type { ListenHandlers, Voice } from './types';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let active: Recognition | null = null;

function britishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'en-GB') ?? voices.find((v) => v.lang.startsWith('en-GB')) ?? null;
}

const errorMessages: Record<string, string> = {
  'not-allowed': 'The browser was not allowed to use the microphone. You can allow it in the address bar, or type instead.',
  'no-speech': 'Scout did not hear anything. Try again, or type instead.',
  'audio-capture': 'No microphone was found. Please type instead.',
  network: 'Speech recognition needs an internet connection. Please type instead.',
};

export const browserVoice: Voice = {
  mode: 'browser',
  canListen: () => recognitionConstructor() !== null,

  listen(handlers: ListenHandlers) {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      handlers.onError('This browser cannot listen. Please type your answer, or use Chrome to speak.');
      handlers.onEnd();
      return;
    }
    active?.stop();
    const recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;
    let settled = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) settled += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      handlers.onText(`${settled}${interim}`.trim(), interim === '');
    };
    recognition.onerror = (event) => handlers.onError(errorMessages[event.error] ?? 'Listening stopped. Try again, or type instead.');
    recognition.onend = () => {
      if (active === recognition) active = null;
      handlers.onEnd();
    };
    active = recognition;
    recognition.start();
  },

  speak(text: string) {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return resolve();
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      const voice = britishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  },

  stop() {
    active?.stop();
    active = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  },
};
