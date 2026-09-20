'use client';

// The live check in interview. It starts as soon as the page opens, talks only to our own server
// routes, and never loses what the person has typed or said.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { btnLink, btnPrimary, card, errorPanel, focusRing, waiting } from '@/components/ui';
import { defaultVoiceMode, getVoice } from '@/lib/voice';

export interface InterviewTurnView {
  turn_no: number;
  speaker: 'scout' | 'employee';
  text: string;
  kind: string | null;
  evidence: string | null;
}

interface Props {
  checkInId: string;
  initialTurns: InterviewTurnView[];
  initialSuggestion: string | null;
}

type Phase = 'starting' | 'asking' | 'thinking' | 'failed' | 'preparing' | 'preparing_slow';

const REPLY_TIMEOUT_MS = 12_000;
const POLL_EVERY_MS = 2_000;
const POLL_LIMIT_MS = 60_000;
const ABOUT_QUESTIONS = 5;

interface TurnReply {
  ok: boolean;
  message?: string;
  reply?: { done: boolean; turn_no: number; question: string; kind: string; evidence: string };
  suggested_answer?: string | null;
}

export default function InterviewClient({ checkInId, initialTurns, initialSuggestion }: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<InterviewTurnView[]>(initialTurns);
  const [draft, setDraft] = useState('');
  const lastInitial = initialTurns[initialTurns.length - 1];
  // If the page opens with the employee's answer last, Scout's reply to it was lost on the way.
  const replyLost = lastInitial?.speaker === 'employee';
  const [phase, setPhase] = useState<Phase>(() => {
    if (!lastInitial) return 'starting';
    if (replyLost) return 'failed';
    return lastInitial.kind === 'closing' ? 'preparing' : 'asking';
  });
  const [problem, setProblem] = useState<string | null>(replyLost ? 'Scout has not answered your last message yet.' : null);
  const [suggestion, setSuggestion] = useState<string | null>(initialSuggestion);
  const [inputMode, setInputMode] = useState<'type' | 'speak'>(() => (defaultVoiceMode() === 'text' ? 'type' : 'speak'));
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(replyLost ? lastInitial.text : null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scoutTurns = turns.filter((t) => t.speaker === 'scout');
  const current = scoutTurns[scoutTurns.length - 1];
  const earlier = current ? turns.filter((t) => t.turn_no < current.turn_no) : [];
  // An answer already saved after the current question, while Scout's reply is awaited.
  const pendingSaved = current ? turns.find((t) => t.speaker === 'employee' && t.turn_no > current.turn_no) : undefined;
  const shownAnswer = pendingSaved?.text ?? lastSent;
  const questionNumber = scoutTurns.filter((t) => t.kind !== 'closing').length;

  const speakAloud = useCallback(
    (text: string) => {
      if (inputMode === 'speak') void getVoice('browser').speak(text);
    },
    [inputMode],
  );

  const pollUntilSummarised = useCallback(async () => {
    setPhase('preparing');
    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_LIMIT_MS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
      try {
        const res = await fetch(`/api/check-in/${encodeURIComponent(checkInId)}/status`, { cache: 'no-store' });
        const data = (await res.json()) as { ok: boolean; status?: string };
        if (data.ok && data.status && ['summarised', 'submitted', 'approved', 'returned'].includes(data.status)) {
          router.replace(`/check-in/${encodeURIComponent(checkInId)}/summary`);
          return;
        }
      } catch {
        // A missed poll is fine: the next one tries again.
      }
    }
    setPhase('preparing_slow');
  }, [checkInId, router]);

  const send = useCallback(
    async (text: string | null) => {
      setLastSent(text);
      setProblem(null);
      setPhase(text === null && turns.length === 0 ? 'starting' : 'thinking');
      getVoice('browser').stop();
      setListening(false);
      let data: TurnReply;
      try {
        const res = await fetch(`/api/check-in/${encodeURIComponent(checkInId)}/turn`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ employee_text: text }),
          signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
        });
        data = (await res.json()) as TurnReply;
        if (!res.ok || !data.ok || !data.reply) {
          setProblem(data.message ?? 'Scout could not answer just now.');
          setPhase('failed');
          return;
        }
      } catch {
        setProblem('Scout is taking longer than usual to answer.');
        setPhase('failed');
        return;
      }

      const reply = data.reply;
      setTurns((prev) => {
        const next = prev.filter((t) => t.turn_no < reply.turn_no - (text === null ? 0 : 1));
        if (text !== null) next.push({ turn_no: reply.turn_no - 1, speaker: 'employee', text, kind: null, evidence: null });
        next.push({ turn_no: reply.turn_no, speaker: 'scout', text: reply.question, kind: reply.kind, evidence: reply.evidence });
        return next;
      });
      setDraft('');
      setSuggestion(data.suggested_answer ?? null);
      speakAloud(reply.question);
      if (reply.done) {
        void pollUntilSummarised();
      } else {
        setPhase('asking');
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [checkInId, pollUntilSummarised, speakAloud, turns.length],
  );

  // Start the moment the page opens, or resume polling if the interview already finished.
  // Runs once; the timer is cleared if the page is torn down before it fires.
  useEffect(() => {
    const last = initialTurns[initialTurns.length - 1];
    if (last && last.kind !== 'closing') return;
    const timer = setTimeout(() => void (last ? pollUntilSummarised() : send(null)), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => getVoice('browser').stop(), []);

  function submitDraft() {
    const text = draft.trim();
    if (!text || phase === 'thinking') return;
    void send(text);
  }

  function startListening() {
    const voice = getVoice('browser');
    if (!voice.canListen()) {
      setVoiceNotice('This browser cannot listen. Please type your answer, or use Chrome to speak.');
      setInputMode('type');
      return;
    }
    setVoiceNotice(null);
    const before = draft.trim();
    setListening(true);
    voice.listen({
      onText: (heard) => setDraft(before ? `${before} ${heard}` : heard),
      onEnd: () => setListening(false),
      onError: (message) => setVoiceNotice(message),
    });
  }

  function stopListening() {
    getVoice('browser').stop();
    setListening(false);
  }

  function switchMode(mode: 'type' | 'speak') {
    if (mode === 'type') stopListening();
    if (mode === 'speak' && !getVoice('browser').canListen()) {
      setVoiceNotice('This browser cannot listen. Please type your answer, or use Chrome to speak.');
      return;
    }
    setVoiceNotice(null);
    setInputMode(mode);
  }

  const busy = phase === 'thinking' || phase === 'starting';
  const finished = phase === 'preparing' || phase === 'preparing_slow' || current?.kind === 'closing';

  return (
    <div className="space-y-8">
      {earlier.length > 0 && (
        <ol aria-label="Earlier in this conversation" className="space-y-3">
          {earlier.map((t) => (
            <li key={t.turn_no} className={t.speaker === 'scout' ? 'text-lg text-muted' : 'ml-10 rounded-lg bg-track px-5 py-3 text-lg text-ink'}>
              <span className="font-semibold">{t.speaker === 'scout' ? 'Scout: ' : 'You: '}</span>
              {t.text}
            </li>
          ))}
        </ol>
      )}

      <section aria-live="polite" className={`min-h-64 ${card}`}>
        {current ? (
          <>
            {!finished && <p className="mb-3 text-lg font-medium text-accent">{`Question ${questionNumber} of about ${Math.max(ABOUT_QUESTIONS, questionNumber)}`}</p>}
            <p className="text-3xl font-semibold leading-snug">{current.text}</p>
            {current.evidence && (
              <p className="mt-4 text-lg text-muted">
                <span className="font-semibold">What Scout saw: </span>
                {current.evidence}
              </p>
            )}
          </>
        ) : (
          <p className={`animate-pulse text-2xl ${waiting}`}>Scout is reading your calendar and your recorded calls for the day, and writing its first question.</p>
        )}
        {(phase === 'thinking' || phase === 'failed') && shownAnswer && (
          <p className="mt-6 ml-10 rounded-lg bg-track px-5 py-3 text-lg">
            <span className="font-semibold">You: </span>
            {shownAnswer}
          </p>
        )}
        {busy && current && <p className={`mt-6 animate-pulse text-xl ${waiting}`}>Scout is reading your answer and working out what to ask next.</p>}
        {phase === 'preparing' && <p className={`mt-6 animate-pulse text-xl ${waiting}`}>Scout is adding up your day and writing your summary. It opens on its own in a moment.</p>}
      </section>

      {phase === 'failed' && (
        <div role="alert" className={errorPanel}>
          <p>{problem} Your answer is safe.</p>
          <button type="button" onClick={() => void send(lastSent)} className={btnPrimary}>
            Try again
          </button>
        </div>
      )}

      {phase === 'preparing_slow' && (
        <div role="alert" className={errorPanel}>
          <p>Your summary is taking longer than usual. Your answers are saved.</p>
          <button type="button" onClick={() => void pollUntilSummarised()} className={btnPrimary}>
            Try again
          </button>
        </div>
      )}

      {!finished && (
        <section aria-label="Your answer" className="space-y-4">
          <div role="group" aria-label="How to answer" className="inline-flex rounded-lg border border-line bg-white p-1">
            {(['type', 'speak'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={inputMode === mode}
                onClick={() => switchMode(mode)}
                className={`rounded-md px-5 py-2 text-lg font-medium ${focusRing} ${inputMode === mode ? 'bg-accent text-white' : 'text-ink hover:bg-track'}`}
              >
                {mode === 'type' ? 'Type' : 'Speak'}
              </button>
            ))}
          </div>

          {voiceNotice && <p className="text-lg text-muted">{voiceNotice}</p>}

          {inputMode === 'speak' && (
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={busy}
                className={`inline-flex items-center justify-center rounded-lg border-2 px-6 py-3 text-lg font-semibold ${focusRing} disabled:opacity-50 ${listening ? 'border-accent-dark bg-accent-dark text-white' : 'border-accent bg-white text-accent hover:bg-track'}`}
              >
                {listening ? 'Stop listening' : 'Start speaking'}
              </button>
              <p className="text-lg text-muted">{listening ? 'Listening. Your words appear in the box below, where you can change them.' : 'Your words appear in the box below, where you can change them before sending.'}</p>
            </div>
          )}

          <label htmlFor="answer" className="block text-lg font-medium">
            Your answer
          </label>
          <textarea
            id="answer"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitDraft();
              }
            }}
            rows={4}
            className={`w-full resize-y rounded-lg border border-line bg-white px-5 py-4 text-xl leading-relaxed ${focusRing}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-base text-muted">Enter sends. Shift and Enter starts a new line.</p>
            <button type="button" onClick={submitDraft} disabled={busy || draft.trim().length === 0} className={btnPrimary}>
              Send
            </button>
          </div>
          {suggestion && !busy && (
            <button
              type="button"
              onClick={() => {
                setDraft(suggestion);
                inputRef.current?.focus();
              }}
              className={btnLink}
            >
              Use Elena&apos;s scripted answer
            </button>
          )}
        </section>
      )}
    </div>
  );
}
