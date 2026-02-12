'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
/**
 * Dev test page: design system components.
 */
export default function DevTestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to Home">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Dev Test Page</h1>
            <p className="text-sm text-muted-foreground">
              Design system components and integration tests. Linked from Workspace.
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Component Showcase</h2>
          <Card className="border-dashed border-muted-foreground/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Navigation, Forms, Dialog, ErrorMessage, Data Display</CardTitle>
              <CardDescription>
                All design system components in one place.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href="/component-showcase">Open Component Showcase</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/" className="underline hover:text-foreground">
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  );
}
