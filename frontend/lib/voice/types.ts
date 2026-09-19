// The voice layer: how words go in and out. The questions always come from the interview scenario;
// this only changes whether the person types or speaks, and whether questions are read aloud.

export type VoiceMode = 'text' | 'browser' | 'slng';

export interface ListenHandlers {
  /** Called as words are recognised. final is true once a phrase is settled. */
  onText: (text: string, final: boolean) => void;
  /** Called when listening stops, for any reason. */
  onEnd: () => void;
  /** Called with a plain message the person can read. */
  onError: (message: string) => void;
}

export interface Voice {
  mode: VoiceMode;
  /** Whether this browser can listen in this mode. */
  canListen: () => boolean;
  listen: (handlers: ListenHandlers) => void;
  /** Reads text aloud. Resolves when finished or when speaking is not available. */
  speak: (text: string) => Promise<void>;
  /** Stops listening and speaking. */
  stop: () => void;
}
