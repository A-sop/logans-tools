import fs from 'node:fs/promises';
import path from 'node:path';

import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GabcSuggestionForm } from '@/app/gabc/_components/gabc-suggestion-form';

async function readDoc(relPathFromSrc: string) {
  const fullPath = path.join(process.cwd(), 'src', relPathFromSrc);
  return await fs.readFile(fullPath, 'utf8');
}

export default async function GabcBoardApprovalPage() {
  const prd = await readDoc(path.join('docs', 'prd', 'gabc-redesign-prd.md'));
  const migrationPlan = await readDoc(path.join('docs', 'prd', 'gabc-migration-plan.md'));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          GABC website redo (early draft)
        </h1>
        <p className="text-sm text-muted-foreground">
          Preview target: <span className="font-medium">gabc.logans.tools</span>
        </p>
      </div>

      <div className="mt-8">
        <Tabs defaultValue="prd">
          <TabsList variant="line">
            <TabsTrigger value="prd">PRD</TabsTrigger>
            <TabsTrigger value="migration">Migration plan + estimate</TabsTrigger>
            <TabsTrigger value="preview">Draft preview</TabsTrigger>
            <TabsTrigger value="suggest">Suggest changes</TabsTrigger>
          </TabsList>

          <TabsContent value="prd" className="mt-6">
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">PRD</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none prose-p:leading-relaxed prose-a:text-primary">
                <ReactMarkdown>{prd}</ReactMarkdown>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="migration" className="mt-6">
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">
                  Migration plan + time estimate
                </CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none prose-p:leading-relaxed prose-a:text-primary">
                <ReactMarkdown>{migrationPlan}</ReactMarkdown>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">
                  Draft preview checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This tab will host the live draft pages as we build them. For now, use it as a
                  checklist of what should exist on{' '}
                  <span className="font-medium text-foreground">gabc.logans.tools</span>.
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <Link href="/gabc-draft/home" className="font-medium text-primary hover:underline">
                      Home (draft)
                    </Link>{' '}
                    — positioning, patrons proof, clear next action
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Events</span> — list + detail,
                    registration CTA
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Membership</span> — tiers,
                    benefits, apply flow
                  </li>
                  <li>
                    <span className="font-medium text-foreground">About</span> — council story,
                    chapters, board
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Contact + legal</span> — inquiry
                    paths, Impressum/Datenschutz
                  </li>
                </ul>
                <p>
                  As routes land, I’ll replace these bullets with direct links to the draft pages.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggest" className="mt-6">
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold leading-tight">
                  Suggest changes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Share feedback for this draft. This sends an email to{' '}
                  <span className="font-medium">logan.williams@gabc.eu</span>.
                </p>
                <GabcSuggestionForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

