import Link from 'next/link';

const BOOKING_URL = 'https://lp.germanfinancialplanning.de/nextmeeting/';
const WHATSAPP_URL =
  'https://api.whatsapp.com/send?phone=49022195491545&text=Hi+there+Logan!+I+saw+your+website+and+thought+I%27d+introduce+myself+and+see+if+you+can+help';

export const metadata = {
  title: 'Work With Me',
  description:
    'Financial planning for expats in Germany. Health insurance, pensions, and clarity on how things work here.',
};

export default function WorkWithMePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Work With Me
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Financial planning for expats who want clarity on how Germany works.
      </p>

      <div className="mt-8 space-y-6 text-foreground">
        <div>
          <h2 className="font-semibold text-foreground">
            What we sort out
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Health insurance — public vs private, what fits your situation</li>
            <li>Pensions — what you have, what you need, how to close the gap</li>
            <li>Tax — Freistellungsauftrag, allowances, the basics</li>
            <li>One person who gets the German system and speaks your language</li>
          </ul>
        </div>
        <p className="text-muted-foreground">
          I help you get clear on priorities, understand what Germany offers and
          expects, and build a plan you can stick to. In person in Cologne or
          over Teams.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Book a chat
        </a>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          WhatsApp
        </a>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        German-speaking clients:{' '}
        <a
          href="https://www.allfinanz.ag/logan.williams/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Allfinanz
        </a>
      </p>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-primary hover:underline"
      >
        ← Home
      </Link>
    </main>
  );
}
