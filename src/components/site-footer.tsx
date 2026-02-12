import Link from 'next/link';

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/legal"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Legal / Impressum
            </Link>
            <Link
              href="/legal#datenschutz"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Datenschutz
            </Link>
            <a
              href="mailto:inbox@loganwilliams.com"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </div>
          <a
            href="https://www.linkedin.com/in/logandwilliams/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            aria-label="LinkedIn"
          >
            LinkedIn
          </a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          © {currentYear} Logan Williams. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
