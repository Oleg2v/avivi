import { notFound } from 'next/navigation';

/** Unknown paths under any locale render the localized 404 inside the site chrome. */
export default function CatchAll() {
  notFound();
}
