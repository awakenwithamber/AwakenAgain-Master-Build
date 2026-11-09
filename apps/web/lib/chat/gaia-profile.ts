/**
 * Gaia-guided profile creation — the conversation script (Gaia
 * profile build, owner spec 2026-11-08: clicking "create my profile"
 * brings the visitor to Gaia, who guides the creation).
 *
 * PURE (no JSX, no browser access) so the script can be unit-tested:
 * every field the profile collects has exactly one Gaia step, in
 * order, and every step states its requirement BEFORE the member
 * answers (the owner's visible-notices rule: requirements up front,
 * never discovered after a failure).
 *
 * Gaia's voice here follows the site's existing Gaia (lib/chat/
 * gaia-guide.ts): warm, plain, garden imagery, no remedy/treatment
 * language, no pressure.
 */

export type GaiaProfileField =
  | 'full_name'
  | 'birthday'
  | 'bio'
  | 'photo'
  | 'phone'
  | 'address'
  | 'birth_chart'
  | 'socials'
  | 'privacy';

export interface GaiaProfileStep {
  field: GaiaProfileField;
  /** Gaia's prompt, shown as her message. */
  prompt: string;
  /** The requirement, stated before input (visible-notices rule). */
  requirement: string;
  required: boolean;
}

export const GAIA_PROFILE_GREETING =
  'Welcome, welcome — I\'m Gaia. Let\'s plant your profile together, one small ' +
  'step at a time. It takes about two minutes, and you can change anything later.';

export const GAIA_PROFILE_STEPS: readonly GaiaProfileStep[] = [
  {
    field: 'full_name',
    prompt: 'First — what name shall your garden grow under? Your full name, as you\'d like it at the gate.',
    requirement: 'Required — your full name (two characters or more).',
    required: true,
  },
  {
    field: 'birthday',
    prompt: 'And when did you arrive in this world? Your birthday lets me draw your star chart — your sun sign and its qualities will live on your feed.',
    requirement:
      'Required — your birthday (YYYY-MM-DD). Profiles are for members 13 and older. Your exact birthday is never shown publicly — only your sun sign is.',
    required: true,
  },
  {
    field: 'bio',
    prompt: 'Tell me a little about yourself — a line or two, the way you\'d introduce yourself to a new friend in the garden.',
    requirement: 'Required — a brief bio (up to 500 characters).',
    required: true,
  },
  {
    field: 'photo',
    prompt: 'Now a picture of you for the garden gate — your profile photo.',
    requirement:
      'Required — a JPG, PNG, or WebP photo under 400 KB. Before it is stored, we strip all location (GPS/EXIF) data from it — that cleaning happens on our side, always.',
    required: true,
  },
  {
    field: 'phone',
    prompt: 'Your phone number, if you\'d like it on your profile. Entirely optional — and it is never shown publicly.',
    requirement: 'Optional — phone number with its country. Never shown publicly.',
    required: false,
  },
  {
    field: 'address',
    prompt: 'Your address, if you\'d like it saved for deliveries. Also optional — and also never shown publicly.',
    requirement: 'Optional — your address. Never shown publicly.',
    required: false,
  },
  {
    field: 'birth_chart',
    prompt: 'For the fuller star chart: if you know the time you were born, and the place, I\'ll keep them with your chart. (The chart itself is still being drawn — for now your feed shows your sun sign in full.)',
    requirement: 'Optional — birth time (24-hour HH:MM) and birth place. Kept private, with your chart.',
    required: false,
  },
  {
    field: 'socials',
    prompt: 'Where else do your people gather? Add your Facebook, TikTok, or Instagram profile — a handle or a link — and your feed will point to them.',
    requirement: 'Optional — your profile handle or URL per network. These are links on your feed, not logins.',
    required: false,
  },
  {
    field: 'privacy',
    prompt: 'Last thing — who may walk in your garden? Your feed starts public so friends can find you, and one switch makes it private whenever you wish. Your before-and-after progress photos start private no matter what — they are shared only if you choose, and they open when you are 18. Reminder emails for photo check-ins are yours to opt into, never automatic.',
    requirement:
      'Your choices: feed public or private (you can change it any time) · progress photos private or shared · check-in reminder emails opt-in or off.',
    required: true,
  },
];

export const GAIA_PROFILE_DONE =
  'Look at that — a garden of your own. Your welcome letter is on its way to ' +
  'your inbox, and your feed is waiting whenever you are. Come back and ' +
  'tend it any time.';

/* ------------------------------------------------------------------ */
/* Skip or tour (owner addition 2026-11-08)                            */
/*                                                                     */
/* At the gate, the visitor chooses: skip Gaia's guided help and go  */
/* straight to the plain form (same fields, same privacy rules), or  */
/* take the tour — Gaia walks the garden one feature at a time       */
/* before the form. The tour copy is enticing about the EXPERIENCE   */
/* — discovering allies, watching progress, seeing your chart — and  */
/* never promises results from any product (wording canon).          */
/* ------------------------------------------------------------------ */

export const GAIA_MODE_QUESTION =
  'Before we begin — would you like me to walk you through your new garden, ' +
  'one wonder at a time? Or would you rather go straight to the form and ' +
  'plant it yourself? Both paths ask the same questions and keep the same ' +
  'promises. The tour just shows you around first.';

export interface GaiaTourStop {
  title: string;
  /** Gaia's enticing, honest description of the feature. */
  body: string;
}

export const GAIA_TOUR_STOPS: readonly GaiaTourStop[] = [
  {
    title: '✦ Your home feed',
    body:
      'Your feed is your garden gate — one page that gathers everything that is yours here: ' +
      'the products you love, the plants that match you, your stars, your story. It starts ' +
      'public so friends can wander in, and one clear switch makes it private whenever you wish.',
  },
  {
    title: '❤ Your favorites',
    body:
      'Tap the heart on any soap, tea, or treasure in the shop and it takes root here, in your ' +
      'favorites — no more hunting for that one scent you adored three visits ago. Your garden ' +
      'remembers what your heart chose.',
  },
  {
    title: '🌿 Your herbal allies',
    body:
      'Take Amber\'s Guided Wellness Quiz and something lovely happens: the botanicals that ' +
      'match your answers gather on your feed as your herbal allies — each with its story and ' +
      'its traditional uses, kept close so you can return to them any time.',
  },
  {
    title: '✧ Your star chart',
    body:
      'The day you arrived says something about the light you carry. Your chart is drawn from ' +
      'your birthday the moment your profile is planted — your sun sign, its element and ' +
      'qualities, and the moon\'s phase on your day. Add your birth time and place, and the ' +
      'chart grows fuller still.',
  },
  {
    title: '🌱 Your progress, in pictures',
    body:
      'Every other week, your garden invites a photo: where you are, beside where you began. ' +
      'Month by month a timeline grows — your own visible story of change, kept private by ' +
      'default and shared only if you choose. (This corner of the garden is for grown-ups: ' +
      'it opens at 18, and gentle reminder emails are there only if you ask for them.)',
  },
  {
    title: '🔒 Your garden, your gates',
    body:
      'Here is my promise, and it is built into the walls, not just the words: your address, ' +
      'your phone number, and your exact birthday are never shown publicly — ever. Your ' +
      'photos arrive with their location data stripped away before they are stored. You hold ' +
      'every gate.',
  },
];

/** The quiz invitation shown PROMINENTLY at the end of both paths. */
export const GAIA_QUIZ_INVITATION = {
  heading: 'One more thing before you wander off…',
  body:
    'Your feed is planted — now let it bloom. Take the Guided Wellness Quiz and the ' +
    'botanicals that match you will gather right here as your herbal allies. It takes ' +
    'a few minutes, and your garden will be waiting, fuller, when you return.',
  ctaLabel: 'Take the Guided Wellness Quiz →',
  ctaHref: '/quiz',
} as const;

/** The step for a field, in script order (undefined for unknown fields). */
export function gaiaProfileStep(field: GaiaProfileField): GaiaProfileStep | undefined {
  return GAIA_PROFILE_STEPS.find((step) => step.field === field);
}
