import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { getPostBySlug, getAllSlugs } from '@/lib/insights';
import { format } from 'date-fns';

export async function generateStaticParams() {
  const slugs = getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return { title: post.title, description: post.excerpt };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/insights"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Insights
      </Link>
      <article className="mt-6">
        <span className="text-xs text-muted-foreground tabular-nums">
          {post.date ? format(new Date(post.date), 'MMMM d, yyyy') : ''}
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {post.title}
        </h1>
        <div className="insight-content mt-6 text-foreground [&_p]:mb-4 [&_p]:leading-relaxed [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
