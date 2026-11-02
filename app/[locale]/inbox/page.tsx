import type { Metadata } from 'next';
import { branches } from '@/lib/data/branches';
import { collections, type CollectionId } from '@/lib/data/collections';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { Inbox } from '@/components/inbox/Inbox';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/inbox', t.inbox.title);
}

export default async function InboxPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const branchNames = Object.fromEntries(branches.map((b) => [b.id, t.showrooms.branches[b.id].name]));
  const collectionNames = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  const topicNames = Object.fromEntries(t.service.topics.map((x) => [x.id, x.label]));
  return (
    <div className="wrap">
      <Inbox locale={locale} t={t.inbox} branchNames={branchNames} collectionNames={collectionNames} projectNames={t.book.projects} topicNames={topicNames} />
    </div>
  );
}
