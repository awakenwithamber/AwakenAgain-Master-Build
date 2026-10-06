/**
 * Honest "content in preparation" state (G7).
 *
 * Used by routes whose content is real but not yet migrated/verified —
 * never placeholder lorem. States exactly what is coming and where to ask
 * in the meantime.
 */
import { BRAND_EMAIL, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '../../lib/seo/config';

export default function InPreparation({
  title,
  whatIsComing,
}: {
  title: string;
  whatIsComing: string;
}) {
  return (
    <div className="in-preparation">
      <h1>{title}</h1>
      <p className="in-preparation-badge">MISSING_ASSET — content in preparation</p>
      <p>{whatIsComing}</p>
      <p>
        We are migrating our full archive into this new site, and we would
        rather show you this honest note than placeholder text. Check back
        soon — or reach us directly:
      </p>
      <p>
        <a href={`mailto:${BRAND_EMAIL}`}>{BRAND_EMAIL}</a>
        <br />
        <a href={BRAND_PHONE_TEL}>{BRAND_PHONE_DISPLAY}</a>
      </p>
    </div>
  );
}
