// For pages: turns a refusal from lib/data.ts into the "not allowed" page.
// redirect() works by throwing, so it is called outside the catch.
import 'server-only';

import { redirect } from 'next/navigation';
import { AccessDenied } from './data';

export async function orRefuse<T>(work: Promise<T>): Promise<T> {
  let refused = false;
  let value: T | undefined;
  try {
    value = await work;
  } catch (error) {
    if (!(error instanceof AccessDenied)) throw error;
    refused = true;
  }
  if (refused) redirect('/not-allowed');
  return value as T;
}
