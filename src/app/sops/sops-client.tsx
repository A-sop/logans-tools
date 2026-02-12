'use client';

import Link from 'next/link';
import { useState, useCallback, type FormEvent } from 'react';
import { FileText, Plus } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { SOP } from './page';

interface SOPsClientProps {
  initialSOPs: SOP[];
}

export function SOPsClient({ initialSOPs }: SOPsClientProps) {
  const [sops, setSops] = useState<SOP[]>(initialSOPs);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      if (!trimmedTitle || !trimmedContent) {
        setError('Title and content are required.');
        return;
      }
      setStatus('loading');
      setError(null);
      // Simulate add — in production, call a server action
      const newSOP: SOP = {
        id: `sop-${Date.now()}`,
        title: trimmedTitle,
        content: trimmedContent,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      setSops((prev) => [newSOP, ...prev]);
      setTitle('');
      setContent('');
      setDialogOpen(false);
      setStatus('idle');
    },
    [title, content]
  );

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setTitle('');
      setContent('');
      setError(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        logoLabel="SOPs"
        logoHref="/sops"
        navItems={[
          { href: '/workspace', label: 'Workspace' },
          { href: '/', label: 'Home' },
        ]}
      />

      <main id="main-content" className="mx-auto max-w-3xl space-y-8 p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Standard Operating Procedures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Procedures for document intake, task assignment, and client communication.
          </p>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Add or update SOP</h2>
            <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add SOP
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>Add SOP</DialogTitle>
                    <DialogDescription>
                      Enter the title and content for the new standard operating procedure.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <FormField
                      id="sop-title"
                      label="Title"
                      required
                      error={error && !title.trim() ? error : null}
                    >
                      <Input
                        id="sop-title"
                        placeholder="e.g. Document Intake and Processing"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setError(null);
                        }}
                        disabled={status === 'loading'}
                      />
                    </FormField>
                    <FormField id="sop-content" label="Content" required>
                      <Textarea
                        id="sop-content"
                        placeholder="Enter the procedure steps, one per line or in paragraphs…"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={6}
                        disabled={status === 'loading'}
                      />
                    </FormField>
                    {error && title.trim() && (
                      <p className="text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      disabled={status === 'loading'}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={status === 'loading' || !title.trim() || !content.trim()}>
                      {status === 'loading' ? 'Adding…' : 'Add SOP'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Current SOPs</h2>
          {sops.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No SOPs yet. Add one above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sops.map((sop) => (
                <Card key={sop.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-tight">{sop.title}</CardTitle>
                    <CardDescription className="text-xs">Updated {sop.updatedAt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                      {sop.content}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/workspace" className="underline hover:text-foreground">
            ← Back to Workspace
          </Link>
        </p>
      </main>
    </div>
  );
}
