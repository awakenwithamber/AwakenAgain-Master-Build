/**
 * /journal/[slug] — journal article detail (G7).
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleViewTracker from '../../../components/content/ArticleViewTracker';
import { JOURNAL_ARTICLES, getArticle } from '../../../lib/content/journal';
import { BRAND_NAME } from '../../../lib/seo/config';

export function generateStaticParams() {
  return JOURNAL_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  return {
    title: article ? article.title : 'Journal',
    description: article
      ? `${article.title} — ${article.excerpt} ${BRAND_NAME} Journal.`
      : 'Apothecary Journal.',
  };
}

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  return (
    <main id="main-content" className="page journal-article-page">
      <ArticleViewTracker slug={article.slug} />
      <article>
        <span className="journal-tag">{article.tag}</span>
        <h1>{article.title}</h1>
        {article.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="journal-wisdom">“{article.wisdom}”</p>
        <p className="journal-herbs-used">
          🌿 Key herbs: {article.keyHerbs.join(', ')}
        </p>
        <p className="article-note">{article.publishedNote}</p>
      </article>
      <p>
        <Link href="/journal">← Back to the Journal</Link>
      </p>
    </main>
  );
}
