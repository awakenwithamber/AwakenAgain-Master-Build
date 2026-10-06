/**
 * article_viewed tracker — fires once when a journal article renders (G7).
 */
'use client';

import { useEffect } from 'react';
import { trackContentOnce } from '../../lib/analytics/content-posthog';

export default function ArticleViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackContentOnce(`article-${slug}`, 'article_viewed', {
      slug,
      section: 'journal',
    });
  }, [slug]);
  return null;
}
