'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataList } from '@/components/ui/data-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/error-message';

/**
 * Component showcase: Navigation, Forms, Dialog, Data display, ErrorMessage.
 * All styled per design system.
 */
export default function ComponentShowcasePage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const sampleListItems = [
    { id: '1', title: 'Submit residence permit application', subtitle: 'Due Jan 15', trailing: <Badge variant="secondary">Todo</Badge> },
    { id: '2', title: 'Request employment contract', subtitle: 'From employer', trailing: <Badge variant="outline">In progress</Badge> },
    { id: '3', title: 'Schedule visa appointment', subtitle: 'Embassy', trailing: <Badge variant="secondary">Done</Badge> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        logoLabel="Component Showcase"
        logoHref="/component-showcase"
        navItems={[
          { href: '/workspace', label: 'Workspace' },
          { href: '/dev-test', label: 'Dev Test' },
          { href: '/', label: 'Home' },
        ]}
      />

      <main className="mx-auto max-w-3xl space-y-12 p-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dev-test" aria-label="Back to Dev Test">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Component Showcase</h1>
            <p className="text-sm text-muted-foreground">
              Design system components: shadcn/ui (customized) vs custom-built
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Navigation (AppHeader)</CardTitle>
            <CardDescription>
              Custom-built. Header with logo and menu items. Uses border-border, spacing scale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Shown at top of this page. shadcn has Navigation Menu (dropdowns); we use a simple
              custom header for flat nav links.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Form Components</CardTitle>
            <CardDescription>
              Input, Textarea, Select from shadcn (customized). FormField, Label custom wrappers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField id="demo-input" label="Email" description="Enter your email address." error={formError}>
              <Input
                id="demo-input"
                placeholder="you@example.com"
                aria-invalid={!!formError}
                aria-describedby={[formError && 'demo-input-error', 'demo-input-desc'].filter(Boolean).join(' ') || undefined}
              />
            </FormField>
            <FormField id="demo-textarea" label="Message" required>
              <Textarea id="demo-textarea" placeholder="Type your message…" rows={3} />
            </FormField>
            <div className="space-y-2">
              <Label htmlFor="demo-select">Status</Label>
              <Select>
                <SelectTrigger id="demo-select" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFormError(formError ? null : 'Invalid email format')}>
              Toggle error state
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Modal / Dialog</CardTitle>
            <CardDescription>
              shadcn/ui Dialog. Customized with our spacing, typography, shadow-lg.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm action</DialogTitle>
                  <DialogDescription>
                    This is a modal dialog. It uses focus trapping and keyboard escape.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. ErrorMessage</CardTitle>
            <CardDescription>
              Custom-built. Inline error message. Uses text-destructive and role=&quot;alert&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium">With message (visible):</p>
              <ErrorMessage message="Something went wrong. Please try again." />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Without message (renders nothing):</p>
              <ErrorMessage message={null} />
              <ErrorMessage message="" />
              <span className="text-xs text-muted-foreground">(No output above)</span>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Toggle (simulates form error):</p>
              <Button variant="outline" size="sm" onClick={() => setShowError(!showError)}>
                {showError ? 'Hide' : 'Show'} error
              </Button>
              <div className="mt-2">
                <ErrorMessage message={showError ? 'Invalid input. Check your data.' : null} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Data Display</CardTitle>
            <CardDescription>
              Table from shadcn. DataList custom-built for list-style display.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-medium">Table (shadcn)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Submit residence permit</TableCell>
                    <TableCell>Todo</TableCell>
                    <TableCell className="text-muted-foreground">Jan 15</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Request employment contract</TableCell>
                    <TableCell>In progress</TableCell>
                    <TableCell className="text-muted-foreground">Jan 20</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium">DataList (custom)</h3>
              <DataList items={sampleListItems} />
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/dev-test" className="underline hover:text-foreground">
            ← Back to Dev Test
          </Link>
        </p>
      </main>
    </div>
  );
}
