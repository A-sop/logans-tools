import Link from 'next/link';
import { getAllPosts } from '@/lib/insights';
import { format } from 'date-fns';

export const metadata = {
  title: 'Insights',
  description: 'Thoughts on life in Germany, personal finance, and navigating the system.',
};

export default function InsightsPage() {
  const posts = getAllPosts();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Insights
      </h1>
      <p className="mt-2 text-muted-foreground">
        Thoughts on life in Germany, personal finance, and making sense of it all.
      </p>

      <div className="mt-10 space-y-6">
        {posts.length === 0 ? (
          <p className="text-muted-foreground">More coming soon.</p>
        ) : (
          posts.map((post) => (
            <Link
              key={post.slug}
              href={`/insights/${post.slug}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent hover:border-border/80"
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

      <div className="mt-12 flex gap-4 text-sm">
        <Link
          href="/insights/life-in-germany"
          className="text-primary hover:underline"
        >
          Life in Germany
        </Link>
        <Link
          href="/insights/personal-finance"
          className="text-primary hover:underline"
        >
          Personal Finance
        </Link>
      </div>
    </main>
  );
}
