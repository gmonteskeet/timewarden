// Picks the voice layer. NEXT_PUBLIC_VOICE_MODE sets the starting mode; the person can switch
// between typing and speaking at any time. SLNG voice arrives in a later task.
import { browserVoice } from './browser';
import { textVoice } from './text';
import type { Voice, VoiceMode } from './types';

export type { ListenHandlers, Voice, VoiceMode } from './types';

export function defaultVoiceMode(): VoiceMode {
  const mode = process.env.NEXT_PUBLIC_VOICE_MODE;
  return mode === 'browser' || mode === 'slng' ? mode : 'text';
}

export function getVoice(mode: VoiceMode = defaultVoiceMode()): Voice {
  // Until SLNG is added, its mode uses the browser's own voice.
  return mode === 'text' ? textVoice : browserVoice;
}
