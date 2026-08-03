'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchPathCompletions, type PathCompleteResult } from '@/lib/atlas-ops/document-intake/review-api-client';

type PathAutocompleteInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function PathAutocompleteInput({
  id,
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: PathAutocompleteInputProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<PathCompleteResult>({ suggestions: [], tabSuffix: null });
  const [loading, setLoading] = useState(false);
  /** Only show dropdown after the user types or presses ArrowDown — not on passive value load. */
  const userWantsSuggestions = useRef(false);

  const loadCompletions = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const next = await fetchPathCompletions(query);
      setResult(next);
      setActiveIndex(0);
      if (userWantsSuggestions.current) {
        setOpen(next.suggestions.length > 0);
      }
    } catch {
      setResult({ suggestions: [], tabSuffix: null });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      return;
    }
    userWantsSuggestions.current = false;
    setOpen(false);
    const handle = window.setTimeout(() => {
      void loadCompletions(value);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [disabled, loadCompletions, value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const applyValue = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      userWantsSuggestions.current = false;
      inputRef.current?.focus();
    },
    [onChange]
  );

  const acceptTabCompletion = useCallback(() => {
    if (result.tabSuffix) {
      applyValue(value + result.tabSuffix);
      return true;
    }
    if (result.suggestions.length === 1) {
      applyValue(result.suggestions[0]);
      return true;
    }
    if (result.suggestions.length > 0 && open) {
      applyValue(result.suggestions[activeIndex] ?? result.suggestions[0]);
      return true;
    }
    return false;
  }, [activeIndex, applyValue, open, result.suggestions, result.tabSuffix, value]);

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={cn(className)}
        onChange={(event) => {
          userWantsSuggestions.current = true;
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Tab' && !event.shiftKey) {
            if (acceptTabCompletion()) {
              event.preventDefault();
            }
            return;
          }

          if (event.key === 'ArrowDown') {
            if (result.suggestions.length > 0) {
              event.preventDefault();
              userWantsSuggestions.current = true;
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, result.suggestions.length - 1));
            }
            return;
          }

          if (event.key === 'ArrowUp') {
            if (result.suggestions.length > 0) {
              event.preventDefault();
              userWantsSuggestions.current = true;
              setOpen(true);
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            return;
          }

          if (event.key === 'Enter' && open && result.suggestions.length > 0) {
            event.preventDefault();
            applyValue(result.suggestions[activeIndex] ?? result.suggestions[0]);
            return;
          }

          if (event.key === 'Escape') {
            setOpen(false);
            userWantsSuggestions.current = false;
          }
        }}
      />

      {open && result.suggestions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-36 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {result.suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                'cursor-pointer px-2 py-1 font-mono text-[11px]',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                applyValue(suggestion);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      ) : null}

      {loading && value.length > 0 ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          …
        </span>
      ) : null}
    </div>
  );
}
