import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const PATRONS = [
  {
    name: 'H.E. Ms Natasha Smith',
    role: 'Australian Ambassador to Germany',
  },
  {
    name: 'Kelly Matthews',
    role: 'Consul-General, Trade and Investment Commissioner, Frankfurt',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'The German-Australia Business Council has been an outstanding networking platform in Germany for Trade and Investment Queensland and our clients for many years.',
    author: 'Stefan Augustin',
    org: 'Trade and Investment Queensland',
  },
  {
    quote:
      'When I moved to Melbourne to complete my MBA it was the connections I had made earlier at GABC events in Germany that opened a lot of doors for me.',
    author: 'Annkatrin Stender',
    org: 'BMW Group',
  },
];

const BENEFITS = [
  {
    title: 'Connections',
    body: 'Real relationships across members, chambers, government departments, and key organisations.',
  },
  {
    title: 'Communication',
    body: 'Timely updates on business-relevant news and events relating to Australia and Germany.',
  },
  {
    title: 'Member services',
    body: 'The right environment and practical intelligence to build trust and generate opportunity.',
  },
];

const OFFERINGS = [
  {
    title: 'Discover our events',
    body: 'Business, networking, and cultural events — in-person and online.',
    href: '/gabc',
    cta: 'See events concept',
  },
  {
    title: 'Become a member',
    body: 'A platform to raise your profile and create business opportunities.',
    href: '/gabc',
    cta: 'See membership concept',
  },
  {
    title: 'Learn about the council',
    body: 'A non-political, non-profit business network fostering long-term relationships.',
    href: '/gabc',
    cta: 'See about concept',
  },
];

export default function GabcDraftHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="border-border text-foreground">
            Draft page
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/gabc">Back to draft hub</Link>
          </Button>
        </div>

        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            25+ years of connecting Germany &amp; Australia
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Bringing Germans and Australians together around business
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            We are a business network created to foster long-term relationships between Germany and
            Australia — through events, introductions, and practical exchange of information.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/gabc">
                Open the draft hub <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/gabc#suggest">Suggest an edit</Link>
            </Button>
          </div>
        </header>
      </div>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">What we offer</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {OFFERINGS.map((o) => (
            <Card key={o.title} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">{o.title}</CardTitle>
                <CardDescription>{o.body}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button asChild variant="link" className="px-0">
                  <Link href={o.href}>
                    {o.cta} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">Our patrons</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PATRONS.map((p) => (
            <Card key={p.name} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">{p.name}</CardTitle>
                <CardDescription>{p.role}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">Benefits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">{b.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{b.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">
          What members say
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <Card key={t.author} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-sm leading-relaxed text-foreground">
                  “{t.quote}”
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{t.author}</div>
                <div className="text-xs">{t.org}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">
          How to get involved
        </h2>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold leading-tight">Where to find us</CardTitle>
            <CardDescription>
              Members are located across Germany with three main chapters: Frankfurt, Berlin, and
              Munich.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Headquarters Frankfurt</div>
            <div>German Australian Business Council e.V.</div>
            <div>Postfach 120143</div>
            <div>60114 Frankfurt am Main, Germany</div>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-primary">
          Corporate members
        </h2>
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold leading-tight">
              Logo grid (placeholder)
            </CardTitle>
            <CardDescription>
              Once we have the approved logo list + usage permissions, this becomes a clean logo grid
              and/or a directory page.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}

