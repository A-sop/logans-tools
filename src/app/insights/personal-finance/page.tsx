import Link from 'next/link';
import { getPostsByTopic } from '@/lib/insights';
import { format } from 'date-fns';

export const metadata = {
  title: 'Personal Finance',
  description:
    'For expats who want clarity, not just contracts. Health insurance, pensions, saving strategies.',
};

export default function PersonalFinancePage() {
  const posts = getPostsByTopic('personal-finance');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Personal Finance
      </h1>
      <p className="mt-3 text-muted-foreground">
        For expats who want clarity, not just contracts. This is where I break
        down the big stuff—health insurance, pensions, smart saving strategies,
        and building a proper financial base. I&apos;m not here to upsell you on
        weird products. I&apos;m here to help you understand your options and
        make decisions you feel good about.
      </p>

      <div className="mt-10 space-y-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">Posts coming soon.</p>
        ) : (
          posts.map((post) => (
            <Link
              key={post.slug}
              href={`/insights/${post.slug}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {post.date ? format(new Date(post.date), 'MMM d, yyyy') : ''}
              </span>
              <h2 className="mt-1 font-semibold text-foreground">{post.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>
            </Link>
          ))
        )}
      </div>

      <Link
        href="/insights"
        className="mt-8 inline-block text-sm text-primary hover:underline"
      >
        ← All Insights
      </Link>
    </main>
  );
}
