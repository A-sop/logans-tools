'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { features } from '@/lib/features';
import { searchDocuments } from '@/lib/search/search';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function QuickSearch() {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!features.search.enabled || !features.search.showInHeader) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = useMemo(() => {
    if (query.trim().length < features.search.minQueryLength) return [];
    return searchDocuments(query, locale, features.search.maxResults);
  }, [locale, query]);

  if (!features.search.enabled || !features.search.showInHeader) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={t('search.navLabel')}
      >
        <Search className="size-4" aria-hidden />
        {t('search.navLabel')}
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          /
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('search.title')}</DialogTitle>
          </DialogHeader>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="max-h-80 overflow-y-auto">
            {query.trim().length < features.search.minQueryLength ? (
              <p className="text-sm text-muted-foreground">{t('search.minChars')}</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('search.noResults')}</p>
            ) : (
              <ul className="space-y-2">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link
                      href={result.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md border border-border p-3 hover:bg-accent/40"
                    >
                      <p className="text-sm font-medium text-foreground">{result.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{result.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            onClick={() => setOpen(false)}
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/90"
          >
            {t('search.openFull')}
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}

