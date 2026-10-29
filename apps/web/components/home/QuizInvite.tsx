/**
 * "Not Sure Where to Begin?" — the Herbal Allies Quiz, on the homepage.
 *
 * Owner directive 2026-10-29: the quiz belongs ON the homepage, under
 * the original Netlify-era invitation, not only behind the hero's link.
 * The full Synthesis quiz island (components/quiz/Quiz) is embedded
 * here, so a visitor can begin — and finish — the quiz without leaving
 * the homepage. The island is self-contained (no props, no routing
 * assumptions, its own scoped stylesheet, absolute API paths), and the
 * same island still serves /quiz unchanged.
 *
 * Copy restores the legacy callout ("Not sure where to begin? Answer a
 * few questions and discover the herbal allies best suited to your
 * body"), merged with the owner's 2026-10-29 wording, with the legacy
 * text's banned wording replaced per the 2026-10-27 wording rule:
 * "a personalized formula crafted around you."
 */
import Quiz from '../quiz/Quiz';
import styles from './home.module.css';

export function QuizInvite() {
  return (
    <section
      className={`${styles.section} ${styles.paneBg}`}
      aria-labelledby="quiz-invite-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="quiz-invite-heading" className={styles.sectionTitle}>
          Not Sure Where to Begin?
        </h2>
        <p className={styles.sectionSub}>
          Answer a few questions — we&rsquo;ll help you discover what your
          body is asking for, and the herbal allies best suited to you. A
          quiet, guided conversation, not a checklist: share what&rsquo;s
          asking for support and Gaia&rsquo;s apothecary will synthesize a
          pattern, the herbs that nourish it, and a personalized formula
          crafted around you.
        </p>
        <div className={styles.quizInviteWrap}>
          <Quiz />
        </div>
      </div>
    </section>
  );
}
