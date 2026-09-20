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

/** The browser's voices. Chrome loads them after the page, so wait briefly for them if needed. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

/** Prefer Google UK English, then any other British English voice, then the browser's default (null). */
async function britishVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  const british = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase().startsWith('en-gb');
  return voices.find((v) => v.name.startsWith('Google UK English')) ?? voices.find(british) ?? null;
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

  async speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voice = await britishVoice();
    await new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
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
