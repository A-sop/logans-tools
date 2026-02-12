import Link from 'next/link';
import { getPostsByTopic } from '@/lib/insights';
import { format } from 'date-fns';

export const metadata = {
  title: 'Life in Germany',
  description:
    "Insights from the inside—but with a foreigner's filter. Over 16 years of life in Germany.",
};

export default function LifeInGermanyPage() {
  const posts = getPostsByTopic('life-in-germany');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Life in Germany
      </h1>
      <p className="mt-3 text-muted-foreground">
        Insights from the inside—but with a foreigner&apos;s filter. From
        registering your address to decoding German directness and mastering the
        art of opening a beer bottle with literally anything—this is where I share
        insights from over 16 years of life in Germany.
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
