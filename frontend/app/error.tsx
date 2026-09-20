'use client';

// Shown when a page cannot load, for example when the database does not answer. The detail is
// logged on the server; people only ever see a plain message and a way to try again.

import { btnPrimary } from '@/components/ui';

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">This page could not load just now</h1>
      <p className="text-xl text-muted">Nothing has been lost. It is usually a short delay in reaching the data. Please try again.</p>
      <button type="button" onClick={() => retry()} className={btnPrimary}>
        Try again
      </button>
    </div>
  );
}
