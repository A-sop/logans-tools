import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export type Topic = 'life-in-germany' | 'personal-finance';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  topic: Topic;
}

export interface Post extends PostMeta {
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'insights');

export function getAllSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? '',
    excerpt: data.excerpt ?? '',
    topic: data.topic ?? 'life-in-germany',
    content,
  };
}

export function getAllPosts(): Post[] {
  const slugs = getAllSlugs();
  const posts = slugs
    .map((s) => getPostBySlug(s))
    .filter((p): p is Post => p !== null)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  return posts;
}

export function getPostsByTopic(topic: Topic): Post[] {
  return getAllPosts().filter((p) => p.topic === topic);
}
