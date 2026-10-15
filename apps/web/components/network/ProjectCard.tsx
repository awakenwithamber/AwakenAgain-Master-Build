/**
 * One AWAKEN-series project pane for /network: name, the documented
 * one-liner, and its honest status line. The only project with a
 * destination today is the apothecary itself (this site); the rest
 * point at the affiliate-interest form on the same page — no project
 * gets a link, date, or feature claim it does not have.
 */
import Link from 'next/link';
import type { NetworkProject } from '../../lib/content/network';
import styles from './network.module.css';

export function ProjectCard({ project }: { project: NetworkProject }) {
  return (
    <article className={styles.projectCard}>
      <p
        className={`${styles.projectStatus} ${
          project.status === 'live' ? styles.projectStatusLive : ''
        }`}
      >
        {project.status === 'live' ? '● ' : '✦ '}
        {project.statusLabel}
      </p>
      <h3 className={styles.projectName}>{project.name}</h3>
      <p className={styles.projectLine}>{project.oneLiner}</p>
      <p className={styles.projectAction}>
        {project.href ? (
          <Link href={project.href}>Browse the apothecary →</Link>
        ) : (
          <a href="#affiliate-interest">Register your interest ↓</a>
        )}
      </p>
    </article>
  );
}
