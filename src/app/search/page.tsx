'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/components/providers/locale-provider';
import { features } from '@/lib/features';
import { searchDocuments } from '@/lib/search/search';

export default function SearchPage() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const query = (params.get('q') ?? '').trim();

  const results = useMemo(() => {
    if (query.length < features.search.minQueryLength) return [];
    return searchDocuments(query, locale, features.search.maxResults);
  }, [locale, query]);

  if (!features.search.enabled) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-foreground">{t('search.title')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('search.disabled')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-foreground">{t('search.title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('search.hint')}</p>

      <form action="/search" className="mt-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t('search.placeholder')}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </form>

      {query.length >= features.search.minQueryLength ? (
        <section className="mt-8 space-y-3">
          <p className="text-sm text-muted-foreground">{t('search.resultsFor', { query })}</p>
          {results.length > 0 ? (
            <ul className="space-y-3">
              {results.map((result) => (
                <li key={result.id} className="rounded-lg border border-border p-4">
                  <Link href={result.href} className="text-base font-medium text-foreground hover:underline">
                    {result.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{result.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
          )}
        </section>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">{t('search.minChars')}</p>
      )}
    </main>
  );
}

