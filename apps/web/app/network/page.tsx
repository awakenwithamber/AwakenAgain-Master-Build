/**
 * /network — The Awaken Network (owner order 2026-10-15, audit fix #8).
 *
 * The AWAKEN series in one pane: one card per project with its
 * documented one-liner and honest status (only the apothecary is live
 * today), plus the affiliate-interest signup. Content lives in
 * lib/content/network.ts — this page invents nothing.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { NETWORK_PROJECTS } from '../../lib/content/network';
import { ProjectCard } from '../../components/network/ProjectCard';
import { AffiliateInterestForm } from '../../components/network/AffiliateInterestForm';
import { BRAND_NAME } from '../../lib/seo/config';
import styles from '../../components/network/network.module.css';

export const metadata: Metadata = {
  title: 'The Awaken Network',
  description: `The AWAKEN series from ${BRAND_NAME} and Awaken With Amber LLC: the apothecary, the Awaken Network community platform, Awaken Mobile, Farah Growth Studio, AWAKEN Agents, Awaken Eco-Villages, and BrandAlchemy — where each project stands, and how to get involved.`,
  alternates: { canonical: '/network' },
};

export default function NetworkPage() {
  return (
    <main id="main-content" className={styles.pageMain}>
      <div className={styles.hero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>The Awaken Network</h1>
        <p>
          This apothecary is one pane of something larger: a family of
          projects growing under Awaken With Amber LLC. Here is every
          project in the series, where each one honestly stands today,
          and how to raise your hand for the ones that call to you.
        </p>
      </div>

      <div className={styles.projectGrid}>
        {NETWORK_PROJECTS.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>

      <section
        className={styles.sectionBlock}
        id="affiliate-interest"
        aria-labelledby="affiliate-heading"
      >
        <h2 id="affiliate-heading">Become an Affiliate</h2>
        <p className={styles.sectionIntro}>
          An affiliate program for the series is in the works. It is still
          forming — registering your interest simply lets Amber know you
          would like to hear more as it takes shape. Nothing is promised
          at this stage, to you or by you.
        </p>
        <AffiliateInterestForm />
      </section>

      <p className={styles.crossLink}>
        Rather bring an idea, a skill, a product, funding, or land?{' '}
        <Link href="/partner">See the ways to partner →</Link>
      </p>
    </main>
  );
}
