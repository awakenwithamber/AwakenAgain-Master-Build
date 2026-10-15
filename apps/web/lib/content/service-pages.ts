/**
 * Service landing pages (Phase 2 professional-services build, 2026-10-14).
 *
 * Nine in-depth landing pages under /services/<slug>, built in the same
 * pattern as lib/content/services.ts: a hand-written content registry
 * layered over the canonical catalog. Prices, titles, and warnings are
 * ALWAYS read from the mapped catalog record at render time — never
 * restated here — so a landing page can never drift from the shop or
 * invent a price.
 *
 * Mapping rules (owner constitution):
 * - A page with a priced catalog record books through the existing cart /
 *   checkout mechanism at the catalog price (server re-derives totals).
 * - A page whose record has no price — or with no record at all — shows
 *   NO price and routes to the contact/inquiry path. Pricing for
 *   unpriced services is a pending owner decision; nothing is invented.
 * - Copy is capability + process only: no credentials, years, reviews,
 *   testimonials, or outcome guarantees. Healing-adjacent copy frames the
 *   work as spiritual support alongside licensed care, never therapy.
 * - Images reuse the existing service illustrations where they genuinely
 *   depict the service. Pages without a matching illustration use the
 *   site's established ✦ fallback panel — an illustration is never
 *   mislabeled as a photograph and no mismatched mapping is guessed.
 */
import { getProductByHandle } from '../catalog/products';
import type { InterestCategory } from '../personalization/interests';

export interface ServicePageEntry {
  /** URL slug under /services/<slug>. */
  slug: string;
  /** H1 and metadata title for the landing page. */
  title: string;
  /** Small caps eyebrow above the title. */
  eyebrow: string;
  /** Meta description / OpenGraph description. */
  metaDescription: string;
  /** Catalog handle this page maps to, or null for a brand-new service. */
  catalogHandle: string | null;
  /**
   * Illustration under /images/services/, reusing the file the mapped
   * service already uses — or null when no existing illustration
   * genuinely depicts this service (page renders the ✦ fallback panel).
   */
  image: string | null;
  imageAlt: string;
  /** Personalization accrual category, where one honestly applies. */
  interestCategory: InterestCategory | null;
  /** One honest line on where/how the service happens. */
  deliveryNote: string;
  /** Opening paragraphs. */
  intro: string[];
  /** What a session includes — capability/process statements only. */
  includes: string[];
  /** How it works, step by step, without inventing logistics. */
  process: string[];
  /** Grounded notes, framings, and guardrails. */
  goodToKnow: string[];
  /** Other landing-page slugs to cross-link. */
  relatedSlugs: string[];
}

export const SERVICE_PAGES: ServicePageEntry[] = [
  {
    slug: 'astrology',
    title: 'Astrology Readings',
    eyebrow: 'Readings · Salt Lake City & Online',
    metaDescription:
      'Reflective astrology readings from Amber’s Alchemy Apothecary — your birth chart explored as a map of symbolism, cycles, and intention. Prepared in Salt Lake City, Utah and delivered wherever you are.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Astrology reading illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Prepared from your birth details and shared with you remotely; Salt Lake City locals are welcome to ask about meeting in person.',
    intro: [
      'An astrology reading at the apothecary is a slow, reflective look at the chart you were born under — the placements, patterns, and seasons of your life read as symbolism you can work with, not a script you are bound to.',
      'Amber reads the chart the way she reads everything here: as a living map. The planets and houses become a language for the questions you are already carrying — work, love, timing, change — and the reading gives those questions shape, context, and a few honest next steps.',
    ],
    includes: [
      'A reading of your natal chart — the placements and patterns most relevant to the questions you bring',
      'A look at the cycles and transits moving through your chart right now',
      'Space to ask about one or two areas of life in depth — work, relationships, home, direction',
      'Grounded takeaways: themes to watch, seasons to honor, and intentions worth setting',
    ],
    process: [
      'Reach out through the contact page with the birth date, time, and place you want read, and the questions on your heart.',
      'Amber prepares your chart by hand and studies it before your reading is shared.',
      'You receive your reading and space to ask follow-up questions about what it stirred up.',
    ],
    goodToKnow: [
      'Readings are a reflective, symbolic practice — offered for insight and intention-setting, not as predictions with guaranteed outcomes.',
      'An exact birth time gives the fullest chart; if you do not know yours, say so and we will work with what you have.',
    ],
    relatedSlugs: ['tarot', 'past-life-regression'],
  },
  {
    slug: 'tarot',
    title: 'Tarot Readings',
    eyebrow: 'Readings · Delivered Digitally',
    metaDescription:
      'Tarot readings for insight, reflection, and intuitive guidance — choose a Mini Reading or a Full Reading and bring your question. A reflective, spiritual practice from Amber’s Alchemy Apothecary.',
    catalogHandle: 'tarot-readings',
    image: 'tarot-readings.webp',
    imageAlt: 'Illustration for Tarot Readings',
    interestCategory: 'readings',
    deliveryNote:
      'A digital reading — choose your reading type, submit your question or topic, and your reading is prepared for you.',
    intro: [
      'Tarot at the apothecary is a reflective practice: symbolism and archetypes laid out on the table so you can see your own situation from a new angle. The cards do not hand down a fate — they hold up a mirror, and mirrors are honest things.',
      'Bring a question, a crossroads, or a season of life that needs language. Amber reads for insight and intention-setting, weaving the imagery of the cards with the grounded, botanical spirit of this house.',
    ],
    includes: [
      'Your choice of reading depth — a Mini Reading for one focused question, or a Full Reading for the wider landscape',
      'A reading shaped around the question or topic you submit',
      'Symbolism and archetypes interpreted for personal insight and intention-setting',
      'A companion to ritual: readings pair naturally with the apothecary’s teas and custom work',
    ],
    process: [
      'Choose Mini or Full below and add your reading to the cart.',
      'Submit your question or topic with your order.',
      'Amber draws and reads your cards, and your reading is delivered to you — scheduling and delivery details are confirmed with you personally.',
    ],
    goodToKnow: [
      'No predictive powers are claimed; readings are framed as reflective and symbolic.',
      'Prefer runes woven in? The Tarot + Rune Reading blends both traditions — it is arranged personally, so reach out through the contact page.',
    ],
    relatedSlugs: ['astrology', 'past-life-regression'],
  },
  {
    slug: 'house-cleansing',
    title: 'House Cleansing',
    eyebrow: 'Space Cleansing · Salt Lake City & the Wasatch Front',
    metaDescription:
      'House cleansing in Salt Lake City, Utah — a personalized spiritual cleansing ritual for your home using intention, symbolism, and botanical elements, from Amber’s Alchemy Apothecary.',
    catalogHandle: 'home-aura-space-cleansing',
    image: 'home-aura-space-cleansing.webp',
    imageAlt: 'Illustration for Home, Aura & Space Cleansing',
    interestCategory: 'readings',
    deliveryNote:
      'An in-person service for homes in Salt Lake City and along the Wasatch Front, arranged personally with Amber.',
    intro: [
      'Homes hold weather. A house cleansing is a deliberate resetting of a space’s atmosphere — a personalized spiritual ritual using intention, symbolism, and selected aromatic and botanical elements to mark a threshold: a move, a loss, a new beginning, or simply a room that has felt heavy for too long.',
      'This is Amber’s own practice, rooted in the apothecary’s botanical tradition: smoke, scent, sound, and spoken intention, carried room to room with care. It is offered for reflective and symbolic purposes — a way of saying, out loud and on purpose, this home starts fresh now.',
    ],
    includes: [
      'A conversation first — what has happened in the space, and what you want it to feel like',
      'A personalized cleansing ritual built for your home, using intention, symbolism, and selected aromatic or botanical elements',
      'Attention to thresholds, corners, and the rooms that carry the most weight',
      'Simple practices you can repeat yourself to keep the space feeling like yours',
    ],
    process: [
      'Reach out through the contact page and tell Amber about the home and the moment you are in.',
      'Together you arrange the visit — timing, the shape of the ritual, and what to prepare.',
      'Amber comes to your home and leads the cleansing; you are welcome to take part in every step.',
    ],
    goodToKnow: [
      'A spiritual service only — not a cleaning, medical, or remediation service, and no claim is made that it removes disease, toxins, or objectively measurable entities.',
      'Pricing is arranged personally — reach out for current details.',
    ],
    relatedSlugs: ['aura-cleansing', 'spirit-resolution'],
  },
  {
    slug: 'aura-cleansing',
    title: 'Aura Cleansing',
    eyebrow: 'Energy Cleansing · Salt Lake City',
    metaDescription:
      'Aura cleansing with Amber in Salt Lake City, Utah — a personalized spiritual cleansing ritual using intention, symbolism, and botanical elements to help you feel clear, light, and your own again.',
    catalogHandle: 'home-aura-space-cleansing',
    image: 'home-aura-space-cleansing.webp',
    imageAlt: 'Illustration for Home, Aura & Space Cleansing',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber in Salt Lake City — reach out and we will find the format that fits.',
    intro: [
      'If a house can hold weather, so can a person. An aura cleansing is the personal side of the apothecary’s cleansing work: a one-to-one spiritual ritual using intention, symbolism, and selected aromatic or botanical elements, for the seasons when you feel coated in other people’s weather — a hard year, a draining workplace, a grief that will not lift.',
      'The work is gentle and unhurried. You set the intention; Amber guides the ritual — scent, smoke, sound, and spoken release — so you can walk out feeling like the boundary between you and the world has been redrawn.',
    ],
    includes: [
      'A one-to-one session shaped around what you have been carrying and what you are ready to set down',
      'A personalized cleansing ritual using intention, symbolism, and selected aromatic or botanical elements',
      'A quiet closing — grounding, and a moment to notice what feels different',
      'A simple personal practice to take with you for the days after',
    ],
    process: [
      'Reach out through the contact page and share, in whatever words you have, what you are hoping to clear.',
      'Amber arranges the session with you personally — every detail confirmed together first.',
      'Your session: arrive as you are; the ritual does the rest.',
    ],
    goodToKnow: [
      'A spiritual service offered for reflective and symbolic purposes — not a medical service, and no claim is made that it removes disease, toxins, or objectively measurable entities.',
      'Pricing is arranged personally — reach out for current details.',
    ],
    relatedSlugs: ['house-cleansing', 'inner-healing'],
  },
  {
    slug: 'spirit-resolution',
    title: 'Spirit Resolution',
    eyebrow: 'Space & Spirit Work · Salt Lake City',
    metaDescription:
      'Spirit resolution in Salt Lake City, Utah — calm, grounded spiritual support for homes and people experiencing a heaviness or presence they cannot shake. A ritual of intention, prayer, and clearing with Amber.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Spirit resolution illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Begins with a conversation; in-person work is in Salt Lake City and along the Wasatch Front.',
    intro: [
      'Sometimes a place — or a stretch of life — carries a heaviness that ordinary tidying does not touch: a room nobody wants to sit in, a house with a history, a feeling of being accompanied that you did not invite. Spirit resolution is the apothecary’s answer to that feeling: calm, grounded spiritual work aimed at helping a space, and the people in it, come back to rest.',
      'Amber approaches this work the way she approaches everything here — without theatrics and without fear. Intention, prayer, symbolism, and botanical clearing, carried out respectfully and at your pace, with the household’s own beliefs honored throughout.',
    ],
    includes: [
      'A listening conversation first — what has been experienced, where, and since when',
      'A personalized resolution ritual for the space or situation, built on intention, prayer, and clearing',
      'Attention to the history of the place and the people living with it now',
      'Closing guidance: how to hold the calm afterwards, and what to do if the feeling returns',
    ],
    process: [
      'Reach out through the contact page and tell the story as plainly as you can — nothing you say will be met with anything but respect.',
      'Amber talks it through with you and proposes an approach; nothing begins until you are comfortable with it.',
      'The work itself, in person for Salt Lake City and Wasatch Front homes — unhurried, thorough, and closed with care.',
    ],
    goodToKnow: [
      'This is a spiritual service offered for reflective and symbolic purposes; no claim is made that it removes objectively measurable entities, and outcomes are not guaranteed.',
      'If a situation ever points to a practical cause — a safety hazard, a health concern, a legal matter — Amber will say so plainly and point you to the right professional alongside this work.',
      'Pricing is arranged personally — reach out for current details.',
    ],
    relatedSlugs: ['house-cleansing', 'aura-cleansing'],
  },
  {
    slug: 'past-life-regression',
    title: 'Past-Life Regression',
    eyebrow: 'Guided Exploration · Salt Lake City & Online',
    metaDescription:
      'Past-life regression as guided exploration — visualization, symbolism, and reflection with Amber, framed honestly as imaginative, reflective practice. Salt Lake City, Utah and online.',
    catalogHandle: 'past-life-inspired-guided-exploration',
    image: 'past-life-inspired-guided-exploration.webp',
    imageAlt: 'Illustration for Past-Life-Inspired Guided Exploration',
    interestCategory: 'readings',
    deliveryNote:
      'Guided sessions are arranged personally with Amber — reach out to begin.',
    intro: [
      'Some patterns feel older than this lifetime — a fear with no source, a place you have never visited that feels like home, a story your imagination keeps returning to. A past-life session at the apothecary explores that territory through guided visualization, symbolism, and reflection.',
      'The framing here is honest, and it matters: this is guided imaginative exploration. Whatever imagery or impressions arise are yours to reflect on — they are not presented as verified historical memories, and the value of the session is in what the imagery illuminates about the life you are living now.',
    ],
    includes: [
      'A guided visualization journey, paced gently and led by Amber throughout',
      'Space to explore a theme you bring — a pattern, a relationship, a recurring dream',
      'Time afterwards to talk through what arose and what it might mean for you',
      'A reflective practice you can return to on your own',
    ],
    process: [
      'Reach out through the contact page and share what draws you to this work.',
      'Amber arranges the session with you personally and talks through how to prepare.',
      'Your guided session — comfortable, unhurried, and closed with reflection together.',
    ],
    goodToKnow: [
      'Imagery or impressions arising in a session are not presented as verified historical memories.',
      'Reflective and entertainment-oriented; not a therapeutic or historical-verification service.',
      'Pricing is arranged personally — reach out for current details.',
    ],
    relatedSlugs: ['astrology', 'inner-healing'],
  },
  {
    slug: 'inner-healing',
    title: 'Inner Healing',
    eyebrow: 'Energy Work · Salt Lake City & Online',
    metaDescription:
      'Inner healing sessions with Amber — quiet, intention-based spiritual support for reflection and personal ritual, offered alongside licensed care, never in place of it. Salt Lake City, Utah and online.',
    catalogHandle: 'energy-work',
    image: 'energy-work.webp',
    imageAlt: 'Illustration for Energy Work',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber — reach out to talk first.',
    intro: [
      'Inner healing at the apothecary is quiet work: a one-to-one, intention-based spiritual session designed around reflection and personal ritual. No fixing, no forcing — a held space, a steady guide, and room for whatever you have been carrying to be set down for a while.',
      'Amber draws on the house’s energy-work tradition: breath, intention, symbolism, and the botanical calm this place is built on. People come in heavy seasons — grief, burnout, transition, the long aftermath of hard years — and leave with a ritual of their own to keep.',
    ],
    includes: [
      'A one-to-one session shaped around where you are, not a script',
      'Guided reflection and a personal ritual built during the session, yours to keep',
      'The apothecary’s grounding tools — breath, intention, scent, and symbolism',
      'An unhurried close, with simple next steps for the days after',
    ],
    process: [
      'Reach out through the contact page — a few honest sentences are plenty.',
      'Amber replies personally and arranges the session with you; every detail confirmed together first.',
      'Your session: arrive as you are. That is the whole requirement.',
    ],
    goodToKnow: [
      'This is spiritual support that sits alongside licensed care — it is not therapy, counseling, or medical care, and it is never a substitute for them. If you are working with a therapist or physician, this work is designed to complement that care, and Amber will always encourage you to keep it.',
      'If you are in crisis, please reach out to a licensed professional or a crisis line first — this work will still be here when you are steadier.',
      'Pricing is arranged personally — reach out for current details.',
    ],
    relatedSlugs: ['aura-cleansing', 'past-life-regression'],
  },
  {
    slug: 'business-setup',
    title: 'Business Setup',
    eyebrow: 'For Makers & Small Businesses · Salt Lake City & Online',
    metaDescription:
      'Business setup support from Amber — the systems side of starting well: structure, operations, tools, and an online presence that works. Salt Lake City, Utah and online.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Business setup illustration',
    interestCategory: null,
    deliveryNote:
      'Consultations are arranged personally; the work itself is remote-friendly, with Salt Lake City locals welcome to meet in person.',
    intro: [
      'Behind the apothecary is a systems practice. Amber’s background is enterprise systems, operations, and automation — and this offering puts that side of the house to work for other small businesses: the unglamorous, essential work of setting a business up so it runs clean from the start.',
      'This is for the maker, healer, or founder who has the craft down and a tangle everywhere else — registrations half-finished, tools that do not talk to each other, a presence online that does not match the quality of the work. We sort the tangle into a structure you can actually run.',
    ],
    includes: [
      'A working session on your setup as it stands — what exists, what is missing, what is in the way',
      'Help structuring the operational backbone: workflows, tools, and the order things should happen in',
      'Guidance on connecting the pieces — sales, scheduling, communication, and records that agree with each other',
      'A plain-language plan for what to do next, in what order, and what can wait',
    ],
    process: [
      'Reach out through the contact page with a few lines about your business and where it is stuck.',
      'Amber replies personally — if it is a fit, you arrange a working session together.',
      'You leave with a structure and a plan, and the option of continued help putting it in place.',
    ],
    goodToKnow: [
      'This is operational and systems guidance, not legal, tax, or accounting advice — for filings and formal counsel, Amber will point you to the right licensed professionals and help you prepare for those conversations.',
      'Pricing is arranged personally, scoped to the work — reach out for current details.',
    ],
    relatedSlugs: ['web-development'],
  },
  {
    slug: 'web-development',
    title: 'Web Development',
    eyebrow: 'Websites & Automation · Salt Lake City & Online',
    metaDescription:
      'Web development with Amber — websites, online stores, and automations built for small businesses, designed to be found, to work on every screen, and to be yours. Salt Lake City, Utah and online.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Web development illustration',
    interestCategory: null,
    deliveryNote:
      'Projects are scoped personally and built remotely; Salt Lake City locals are welcome to meet in person.',
    intro: [
      'The site you are standing on is an example of the work: designed, built, and automated in-house. Amber builds websites the same way she builds everything in this ecosystem — as systems that keep working after the launch day: a storefront that sells, pages that load fast and read beautifully on a phone, and the quiet automation underneath that saves its owner hours.',
      'Offered to the small businesses and practitioners this house knows best: if you need a website, an online store, or the tools behind your business connected into one flow, this is that work.',
    ],
    includes: [
      'A scoping conversation — what the site must do, who it serves, and what success looks like',
      'Design and build: pages, storefront, and content structure, mobile-first and accessible',
      'The connective tissue — forms, booking, payments, and automations wired to the tools you already use',
      'A handover you can actually use: how your site works, and how to get help when you need it',
    ],
    process: [
      'Reach out through the contact page with what you are building and where it stands.',
      'Amber replies personally; if it is a fit, the project is scoped and priced in plain language before anything begins.',
      'Build, review together, launch — with the systems underneath documented as they are made.',
    ],
    goodToKnow: [
      'Every project is scoped individually; pricing is arranged personally — reach out for current details.',
      'No outcome promises: a website is a tool, and Amber will be honest about what it can and cannot do for a business.',
    ],
    relatedSlugs: ['business-setup'],
  },
];

export function getServicePage(slug: string): ServicePageEntry | undefined {
  return SERVICE_PAGES.find((p) => p.slug === slug);
}

/** Absolute path for a landing page, e.g. '/services/tarot'. */
export function servicePagePath(slug: string): string {
  return `/services/${slug}`;
}

/**
 * The catalog record a page maps to (undefined for brand-new services).
 * Prices/titles/warnings are read from the record at render — this
 * registry deliberately never restates them.
 */
export function getServicePageRecord(entry: ServicePageEntry) {
  return entry.catalogHandle ? getProductByHandle(entry.catalogHandle) : undefined;
}
