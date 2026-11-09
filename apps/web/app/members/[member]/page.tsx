/**
 * /members/[member] — the PUBLIC member feed (Gaia profile build).
 *
 * The member key is the URL-encoded account email (the app's one
 * identity key). The composition is lib/accounts/member-feed.ts
 * getPublicMemberFeedAsync: it returns null — and this page answers
 * 404 — when the profile is missing, the account is deleted, or the
 * member's feed toggle is PRIVATE. Privacy is refused at the data
 * layer, and the public view's type carries no address, phone, or
 * birthday fields at all.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicMemberFeedAsync } from '../../../lib/accounts/member-feed';
import { MemberFeed } from '../../../components/account/MemberFeed';
import { siteUrl, BRAND_NAME } from '../../../lib/seo/config';
import styles from '../../../components/account/account.module.css';

interface PageProps {
  params: Promise<{ member: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { member } = await params;
  const feed = await getPublicMemberFeedAsync(decodeURIComponent(member));
  if (!feed) return { title: 'Member garden' };
  return {
    title: `${feed.full_name}’s garden`,
    description: `${feed.full_name}’s ${BRAND_NAME} garden: favorites, herbal allies, and star chart.`,
  };
}

export default async function PublicMemberFeedPage({ params }: PageProps) {
  const { member } = await params;
  const email = decodeURIComponent(member);
  const feed = await getPublicMemberFeedAsync(email);
  if (!feed) notFound();

  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>{feed.full_name}’s garden</h1>
        <p>A member garden at Amber’s Alchemy Apothecary — favorites, allies, and stars.</p>
      </div>
      <MemberFeed
        feed={feed}
        publicUrl={`${siteUrl()}/members/${encodeURIComponent(email)}`}
      />
    </main>
  );
}
