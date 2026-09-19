// Typing only: nothing is heard or read aloud.
import type { Voice } from './types';

export const textVoice: Voice = {
  mode: 'text',
  canListen: () => false,
  listen: (handlers) => handlers.onError('Speaking is not available here. Please type your answer.'),
  speak: async () => {},
  stop: () => {},
};
