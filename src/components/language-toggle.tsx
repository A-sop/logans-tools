'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { supportedLocales, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const labels: Record<Locale, string> = {
  en: 'EN',
  de: 'DE',
};

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className="flex rounded-md border border-border bg-muted/50 p-0.5"
      role="group"
      aria-label="Language selection"
    >
      {supportedLocales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={cn(
            'rounded px-2.5 py-1 text-sm font-medium transition-colors',
            locale === loc
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={locale === loc}
          aria-label={`Switch to ${loc === 'en' ? 'English' : 'Deutsch'}`}
        >
          {labels[loc]}
        </button>
      ))}
    </div>
  );
}
