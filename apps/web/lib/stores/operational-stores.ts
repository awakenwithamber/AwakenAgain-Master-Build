/**
 * Provider-neutral operational store interfaces (G12).
 *
 * These interfaces are the DATA MIGRATION contract for everything the
 * legacy system kept in Netlify Blobs / Netlify Forms events:
 *
 *   OLD (legacy)                              NEW (interface → Supabase)
 *   quiz-lead.mjs → Netlify Blobs             QuizLeadStore → quiz_leads
 *   reviews.mjs → Netlify Blobs               ReviewStore → reviews + review queue
 *   submission-created.mjs → Blobs + Forms    SubmissionStore → orders/submissions pipeline
 *   Netlify Forms newsletter                  SubscriberStore → subscribers
 *
 * Migration mapping + order + verification live in
 * docs/migration/DATA_MIGRATION_MAP.md. The Supabase migrations
 * (0001_quiz_and_grimoire.sql) exist but are UNAPPLIED and the project
 * binding is NEEDS VERIFICATION — so every store below ships with a
 * PendingBinding* implementation that refuses to pretend it has data.
 * Admin pages check binding() first and render an honest pending state
 * instead of calling list() and failing.
 *
 * Nothing here reads credentials, creates sessions, or sends email.
 */

export type StoreBindingStatus = 'NEEDS_VERIFICATION';

export interface StoreBinding {
  status: StoreBindingStatus;
  /** What is blocked and on what. Rendered verbatim in admin. */
  detail: string;
}

/** Thrown when code calls a store whose binding is not verified. */
export class StoreNotBoundError extends Error {
  constructor(store: string, detail: string) {
    super(
      `NEEDS VERIFICATION — ${store} is not bound: ${detail}. ` +
        'Call binding() and render the pending state; never fabricate rows.',
    );
    this.name = 'StoreNotBoundError';
  }
}

/* ------------------------------------------------------------------ */
/* Quiz leads (legacy: quiz-lead.mjs → Netlify Blobs)                   */
/* ------------------------------------------------------------------ */

export interface QuizLead {
  lead_id: string;
  email: string;
  first_name?: string;
  sms_opt_in?: boolean;
  quiz_result?: string;
  created_at: string;
}

export interface QuizLeadStore {
  binding(): StoreBinding;
  listLeads(options?: { limit?: number }): Promise<QuizLead[]>;
}

const QUIZ_LEAD_BINDING: StoreBinding = {
  status: 'NEEDS_VERIFICATION',
  detail:
    'quiz_leads table migration (0001_quiz_and_grimoire.sql) is unapplied; ' +
    'Supabase project binding unverified; Netlify Blobs export not yet performed.',
};

export class PendingBindingQuizLeadStore implements QuizLeadStore {
  binding(): StoreBinding {
    return QUIZ_LEAD_BINDING;
  }
  listLeads(): Promise<QuizLead[]> {
    throw new StoreNotBoundError('QuizLeadStore', QUIZ_LEAD_BINDING.detail);
  }
}

/* ------------------------------------------------------------------ */
/* Reviews + moderation queue (legacy: reviews.mjs → Netlify Blobs;    */
/* api/reviews.js adminList/adminUpdate/adminDelete/adminExport)        */
/* ------------------------------------------------------------------ */

export type ReviewModerationState = 'pending' | 'approved' | 'rejected';

export interface ReviewRecord {
  review_id: string;
  product_handle?: string;
  rating: number;
  title?: string;
  body: string;
  author_name?: string;
  moderation: ReviewModerationState;
  created_at: string;
}

export interface ReviewStore {
  binding(): StoreBinding;
  /** Moderation queue: pending reviews first, then newest. Read-only here. */
  listModerationQueue(options?: { limit?: number }): Promise<ReviewRecord[]>;
  listReviews(options?: { limit?: number }): Promise<ReviewRecord[]>;
}

const REVIEW_BINDING: StoreBinding = {
  status: 'NEEDS_VERIFICATION',
  detail:
    'reviews table migration unapplied; Supabase project binding unverified; ' +
    'Netlify Blobs reviews export not yet performed. Moderation actions ' +
    '(approve/reject/export) are contract-only until then.',
};

export class PendingBindingReviewStore implements ReviewStore {
  binding(): StoreBinding {
    return REVIEW_BINDING;
  }
  listModerationQueue(): Promise<ReviewRecord[]> {
    throw new StoreNotBoundError('ReviewStore', REVIEW_BINDING.detail);
  }
  listReviews(): Promise<ReviewRecord[]> {
    throw new StoreNotBoundError('ReviewStore', REVIEW_BINDING.detail);
  }
}

/* ------------------------------------------------------------------ */
/* Form submissions (legacy: Netlify Forms events → form-relay →      */
/* Zapier; form-submit.js → Supabase)                                   */
/* ------------------------------------------------------------------ */

export interface FormSubmission {
  submission_id: string;
  form_type: 'contact' | 'newsletter' | 'custom_formula' | 'grimoire';
  payload_summary: string;
  created_at: string;
}

export interface SubmissionStore {
  binding(): StoreBinding;
  listSubmissions(options?: { limit?: number }): Promise<FormSubmission[]>;
}

const SUBMISSION_BINDING: StoreBinding = {
  status: 'NEEDS_VERIFICATION',
  detail:
    'submission pipeline is the G5/G6 contract (app/api/contact, app/api/quiz-lead) — ' +
    'not built yet; legacy Netlify Forms data export not yet performed.',
};

export class PendingBindingSubmissionStore implements SubmissionStore {
  binding(): StoreBinding {
    return SUBMISSION_BINDING;
  }
  listSubmissions(): Promise<FormSubmission[]> {
    throw new StoreNotBoundError('SubmissionStore', SUBMISSION_BINDING.detail);
  }
}

/* ------------------------------------------------------------------ */
/* Subscribers (legacy: Netlify Forms newsletter; broadcast            */
/* gatherRecipients in admin.html)                                      */
/* ------------------------------------------------------------------ */

export interface SubscriberRecord {
  subscriber_id: string;
  email: string;
  opted_in_at: string;
  unsubscribed: boolean;
}

export interface SubscriberStore {
  binding(): StoreBinding;
  countSubscribers(): Promise<number>;
}

const SUBSCRIBER_BINDING: StoreBinding = {
  status: 'NEEDS_VERIFICATION',
  detail:
    'subscribers table / list source not yet bound (G15). Broadcast composer ' +
    'is UI-only; sending is disabled behind an explicit flag regardless.',
};

export class PendingBindingSubscriberStore implements SubscriberStore {
  binding(): StoreBinding {
    return SUBSCRIBER_BINDING;
  }
  countSubscribers(): Promise<number> {
    throw new StoreNotBoundError('SubscriberStore', SUBSCRIBER_BINDING.detail);
  }
}
