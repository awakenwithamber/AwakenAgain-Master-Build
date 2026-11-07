/**
 * Service landing pages (Phase 2 professional-services build, 2026-10-14;
 * spiritual-services rewrite + five new offerings, owner direction
 * 2026-11-07).
 *
 * Fourteen in-depth landing pages under /services/<slug>, built in the
 * same pattern as lib/content/services.ts: a hand-written content
 * registry layered over the canonical catalog. Prices, titles, and
 * warnings are ALWAYS read from the mapped catalog record at render
 * time — never restated here — so a landing page can never drift from
 * the shop or invent a price.
 *
 * Mapping rules (owner constitution):
 * - A page with a priced catalog record books through the existing cart /
 *   checkout mechanism at the catalog price (server re-derives totals).
 * - A page whose record has no price — or with no record at all — shows
 *   NO price and routes to the contact/inquiry path. Pricing for
 *   unpriced services is a pending owner decision; nothing is invented.
 * - Copy is capability + process only: no credentials, years, reviews,
 *   testimonials, or outcome guarantees. Spiritual-support copy frames
 *   the work as spiritual support alongside licensed care, never therapy.
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
      'Reflective astrology readings from Amber’s Alchemy Apothecary — your birth chart explored as a map of the sky you were born under: symbolism, cycles, and intention. Prepared in Salt Lake City, Utah and delivered wherever you are.',
    catalogHandle: null,
    image: 'astrology.webp',
    imageAlt:
      'Zodiac wheel in gold linework on deep plum — owner-supplied illustration for Astrology Readings',
    interestCategory: 'readings',
    deliveryNote:
      'Prepared from your birth details and shared with you remotely; Salt Lake City locals are welcome to ask about meeting in person.',
    intro: [
      'Think of your birth chart as a map of the sky at the moment you took your first breath — the heavens caught mid-motion, every planet holding a lantern over a different room of your life. An astrology reading is learning to read that map: where your light falls easily, where the shadows gather, and which seasons you are moving through now.',
      'Amber reads the chart the way she reads everything here: as a living map, not a life sentence. The planets and houses become a language for the questions you are already carrying — work, love, timing, change — and the reading gives those questions shape, context, and a few honest next steps, the way a gardener reads the turning year before deciding what to plant.',
    ],
    includes: [
      'A reading of your natal chart — the placements and patterns most relevant to the questions you bring',
      'A look at the cycles and transits moving through your chart right now — the weather of your current season',
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
    relatedSlugs: ['tarot', 'past-life-regression', 'spiritual-guidance'],
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
      'If astrology is a map, tarot is a mirror. The cards are laid out like stones across a stream — each one a symbol, an archetype, a piece of an old story — and together they show you your own situation from an angle you could not reach alone. The cards do not hand down a fate; they hold up a mirror, and mirrors are honest things.',
      'Bring a question, a crossroads, or a season of life that needs language. Amber reads for insight and intention-setting, weaving the imagery of the cards with the grounded, botanical spirit of this house — a lantern lit at the crossroads, so you can choose your road with open eyes.',
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
      'No predictive powers are claimed; readings are framed as reflective and symbolic — offered for spiritual, reflective, and entertainment purposes.',
      'Prefer runes woven in? The Tarot + Rune Reading blends both traditions — it is arranged personally, so reach out through the contact page.',
    ],
    relatedSlugs: ['astrology', 'past-life-regression', 'spiritual-guidance'],
  },
  {
    slug: 'past-life-regression',
    title: 'Past-Life Regression',
    eyebrow: 'Guided Exploration · Salt Lake City & Online',
    metaDescription:
      'Past-life regression as guided exploration — imagine your soul as an old book and this lifetime as one chapter: a gentle journey into the earlier chapters through visualization, symbolism, and reflection with Amber. Salt Lake City, Utah and online.',
    catalogHandle: 'past-life-inspired-guided-exploration',
    image: 'past-life-inspired-guided-exploration.webp',
    imageAlt: 'Illustration for Past-Life-Inspired Guided Exploration',
    interestCategory: 'readings',
    deliveryNote:
      'Guided sessions are arranged personally with Amber — reach out to begin.',
    intro: [
      'Imagine your soul as a very old book, and this lifetime as the chapter you are reading now. Past-life regression is a guided journey to turn back the pages — to peek into the older chapters of the soul’s story, not to live in them, but to understand why this chapter reads the way it does.',
      'That is why certain patterns can feel older than this lifetime: a fear with no source, a place you have never visited that feels like home, a face in a dream you somehow know. In a session, Amber guides you gently into that deeper reading room of the mind — through relaxation, visualization, and symbolism — and walks beside you as the earlier pages open.',
      'The framing here is honest, and it matters: this is guided imaginative exploration. Whatever imagery or impressions arise are yours to reflect on — they are not presented as verified historical memories, and the value of the session is in what the imagery illuminates about the life you are living now.',
    ],
    includes: [
      'A guided visualization journey into the soul’s older chapters, paced gently and led by Amber throughout',
      'Space to explore a theme you bring — a pattern, a relationship, a recurring dream, a fear with no name',
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
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['guided-hypnotherapy', 'astrology', 'inner-renewal'],
  },
  {
    slug: 'guided-hypnotherapy',
    title: 'Guided Hypnotherapy Sessions',
    eyebrow: 'Guided Hypnotherapy · Salt Lake City & Online',
    metaDescription:
      'Guided hypnotherapy sessions with Amber — a lantern-lit descent into the quiet rooms of your own mind, through deep relaxation and guided inner work. Offered as spiritual and reflective practice, never medical treatment. Salt Lake City, Utah and online.',
    catalogHandle: 'hypnotherapy-guided-relaxation',
    image: 'hypnotherapy-guided-relaxation.webp',
    imageAlt: 'Illustration for Hypnotherapy & Guided Relaxation',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber — online, or in person for Salt Lake City locals.',
    intro: [
      'Think of your mind as a house you have lived in all your life — and of how many of its rooms you never actually enter. Guided hypnotherapy is a lantern-lit descent into those quieter rooms: Amber’s voice guides you down, step by step, into a deeply relaxed state where the busy surface mind rests and the deeper mind can finally be heard.',
      'Nothing is taken from you in that state, and nothing is planted there. You remain yourself throughout — simply quiet enough to listen inward: to an old habit’s root, to a younger version of you still waiting to be heard, to the calm underneath the noise. People come to this work to reflect, to unwind the knots they can feel but cannot reach, and to leave with a steadier hand on their own inner door.',
    ],
    includes: [
      'A conversation first — what you would like to explore, in your own words and at your own pace',
      'A guided relaxation journey led by Amber throughout, shaped around your intention',
      'Space to surface slowly and talk through what arose, while it is still vivid',
      'A simple grounding practice to take with you for the days after',
    ],
    process: [
      'Reach out through the contact page and share, in whatever words you have, what you are hoping to explore.',
      'Amber arranges the session with you personally and talks through how to prepare — a quiet space, a comfortable chair, and time afterwards to rest.',
      'Your session: settle in, breathe, and follow the voice down. Amber guides every step and brings you back gently.',
    ],
    goodToKnow: [
      'This is guided relaxation and inner work — a wellness and reflective practice. It is not medical treatment, not diagnosis, and never a substitute for licensed medical or mental-health care; if you are working with a physician or therapist, this work sits alongside that care.',
      'You are in control throughout a session — you can open your eyes, speak, or stop at any moment. Nothing happens that you do not allow.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['past-life-regression', 'inner-renewal', 'spiritual-guidance'],
  },
  {
    slug: 'mediumship',
    title: 'Speaking With Loved Ones Who Have Passed',
    eyebrow: 'Mediumship · Salt Lake City & Online',
    metaDescription:
      'Mediumship sessions with Amber in Salt Lake City, Utah and online — a compassionate space to explore connection with loved ones who have passed, seeking messages, comfort, and guidance across the veil.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Mediumship illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber — begin with a conversation, and we will find the right shape together.',
    intro: [
      'I believe the bonds of love transcend time, distance, and even death — that love is a golden thread, and death does not cut it. As an intuitive medium, I work in the sacred space between the physical world and the unseen: think of the veil between the shores as morning mist, thin in places, and of a session as standing quietly at the water’s edge, listening.',
      'A mediumship session is a compassionate, unhurried space to explore spiritual connection with someone you have lost — a parent, a partner, a friend, a child — seeking meaningful messages, comfort, guidance, and the possibility of emotional closure. You bring the love and the questions; I bring the listening. What comes through arrives as impressions, images, and feelings, offered to you honestly and without embellishment, for you to weigh against your own heart.',
    ],
    includes: [
      'A one-to-one session held gently and without hurry, centered on the loved one you hope to reach',
      'Space to share who they were, what remains unsaid, and what you most hope to hear',
      'Impressions and messages as they come — described plainly, with nothing dressed up or invented',
      'A soft closing: time to sit with what arose, and guidance for carrying it into the days after',
    ],
    process: [
      'Reach out through the contact page and tell Amber, in whatever words you have, who you are hoping to connect with.',
      'Amber replies personally and arranges the session with you — every detail confirmed together first.',
      'Your session: arrive as you are, grief and all. That is the whole requirement.',
    ],
    goodToKnow: [
      'No honest medium can promise that a particular person will come through, or that specific messages will arrive — anyone who guarantees that is selling certainty, and I will not. Sessions are offered for spiritual, reflective, and entertainment purposes, and outcomes are not guaranteed.',
      'This is companionship in grief, not grief therapy or counseling. If you are working with a therapist, this work sits alongside that care — and if grief is overwhelming right now, please let a licensed professional walk with you first; this work will still be here.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['spiritual-guidance', 'ceremonies', 'inner-renewal'],
  },
  {
    slug: 'spiritual-guidance',
    title: 'Spiritual Guidance',
    eyebrow: 'Guidance & Mentoring · Salt Lake City & Online',
    metaDescription:
      'Spiritual guidance and intuitive mentoring with Amber in Salt Lake City, Utah and online — a lantern carried beside you while you learn to trust your own inner compass again.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Spiritual guidance illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber — one conversation at a time, online or in Salt Lake City.',
    intro: [
      'Sometimes the path is not blocked — it is just dark. Spiritual guidance is having someone walk beside you with a lantern: not ahead of you choosing the road, and never behind you pushing, but alongside, while you learn to read your own inner compass again.',
      'These sessions are intuitive mentoring in the truest sense — unhurried conversation about where you are, what your intuition has been trying to say, and what your next honest step might be. Amber draws on the whole of this house’s practice: readings, ritual, energy work, and the grounded botanical calm the apothecary is built on. You will leave with language for what you are in, a practice or two to carry, and the reminder that the compass was yours all along.',
    ],
    includes: [
      'A one-to-one conversation shaped around your questions — direction, transition, calling, or the unnamed restlessness underneath it all',
      'Intuitive reflection: what Amber hears in your story, offered honestly and for you to weigh',
      'Simple practices, rituals, or readings to work with between sessions, if you want them',
      'An unhurried close, with your own next step named in your own words',
    ],
    process: [
      'Reach out through the contact page — a few honest sentences about where you are is plenty.',
      'Amber replies personally and arranges the session with you; every detail confirmed together first.',
      'Your session: a conversation, a lantern, and room to hear yourself think.',
    ],
    goodToKnow: [
      'Spiritual guidance is reflective support, not therapy, counseling, or medical or legal advice — it sits alongside licensed care, never in place of it.',
      'Come as you are, whatever you believe or no longer believe. This door does not check creeds.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['mediumship', 'inner-renewal', 'tarot'],
  },
  {
    slug: 'inner-renewal',
    title: 'Inner Renewal',
    eyebrow: 'Energy Work · Salt Lake City & Online',
    metaDescription:
      'Inner renewal sessions with Amber — quiet, intention-based spiritual support for reflection and personal ritual, like tending embers back to a steady glow. Offered alongside licensed care, never in place of it. Salt Lake City, Utah and online.',
    catalogHandle: 'energy-work',
    image: 'energy-work.webp',
    imageAlt: 'Illustration for Energy Work',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber — reach out to talk first.',
    intro: [
      'Picture a hearth after a long winter: the fire is not out — it never went out — but the embers have gone grey under ash, and the room has forgotten its own warmth. Inner renewal is the tending of that hearth: quiet, intention-based spiritual work that clears the ash gently and breathes the embers back toward glow.',
      'Amber draws on the house’s energy-work tradition: breath, intention, symbolism, and the botanical calm this place is built on. People come in heavy seasons — grief, burnout, transition, the long aftermath of hard years — and leave with a ritual of their own to keep, and a little more light to read by.',
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
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['aura-cleansing', 'guided-hypnotherapy', 'spiritual-guidance'],
  },
  {
    slug: 'aura-cleansing',
    title: 'Personal Cleansing & Blessing',
    eyebrow: 'Energy Cleansing & Blessing · Salt Lake City',
    metaDescription:
      'Personal cleansing and blessing with Amber in Salt Lake City, Utah — a one-to-one spiritual ritual using intention, symbolism, and botanical elements: clear away what you have been carrying, then be blessed for the road ahead.',
    catalogHandle: 'home-aura-space-cleansing',
    image: 'home-aura-space-cleansing.webp',
    imageAlt: 'Illustration for Home, Aura & Space Cleansing',
    interestCategory: 'readings',
    deliveryNote:
      'Sessions are arranged personally with Amber in Salt Lake City — reach out and we will find the format that fits.',
    intro: [
      'If a house can hold weather, so can a person. A personal cleansing is for the seasons when you feel coated in other people’s weather — a hard year, a draining workplace, a grief that will not lift — the way a coat picks up smoke from every room it has passed through. This is the apothecary’s answer: a one-to-one spiritual ritual to wash the coat clean.',
      'And because an emptied space invites something to fill it, every cleansing here ends in a blessing: after the clearing — scent, smoke, sound, and spoken release — Amber speaks intention over what comes next, the way you plant flowers in a bed you have just weeded. You set the intention; the ritual does the rest, so you can walk out feeling like the boundary between you and the world has been redrawn, and the road ahead blessed.',
    ],
    includes: [
      'A one-to-one session shaped around what you have been carrying and what you are ready to set down',
      'A personalized cleansing ritual using intention, symbolism, and selected aromatic or botanical elements',
      'A spoken blessing to close — words chosen for the season you are walking into',
      'A simple personal practice to take with you for the days after',
    ],
    process: [
      'Reach out through the contact page and share, in whatever words you have, what you are hoping to clear.',
      'Amber arranges the session with you personally — every detail confirmed together first.',
      'Your session: arrive as you are; the ritual does the rest.',
    ],
    goodToKnow: [
      'A spiritual service offered for reflective and symbolic purposes — not a medical service, and no claim is made that it removes disease, toxins, or objectively measurable entities.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['house-cleansing', 'inner-renewal', 'protections'],
  },
  {
    slug: 'house-cleansing',
    title: 'Home Cleansing & Blessing',
    eyebrow: 'Space Cleansing & Blessing · Salt Lake City & the Wasatch Front',
    metaDescription:
      'Home cleansing and blessing in Salt Lake City, Utah — a personalized spiritual ritual for your home using intention, symbolism, and botanical elements: clear the old weather out, then bless the threshold. From Amber’s Alchemy Apothecary.',
    catalogHandle: 'home-aura-space-cleansing',
    image: 'home-aura-space-cleansing.webp',
    imageAlt: 'Illustration for Home, Aura & Space Cleansing',
    interestCategory: 'readings',
    deliveryNote:
      'An in-person service for homes in Salt Lake City and along the Wasatch Front, arranged personally with Amber.',
    intro: [
      'Homes hold weather. Every argument, illness, celebration, and sorrow that happens under a roof leaves a little of its climate behind — until one day you walk into a room and feel the air has gone stale with old seasons. A home cleansing is a deliberate resetting of that atmosphere: a personalized spiritual ritual using intention, symbolism, and selected aromatic and botanical elements to mark a threshold — a move, a loss, a new beginning, or simply a room that has felt heavy for too long.',
      'This is Amber’s own practice, rooted in the apothecary’s botanical tradition: smoke, scent, sound, and spoken intention, carried room to room like a river washing through the house. And when the clearing is done, the work closes with a blessing spoken over the threshold — because a home should not just be emptied of the old weather; it should be welcomed into its new season, out loud and on purpose. This home starts fresh now.',
    ],
    includes: [
      'A conversation first — what has happened in the space, and what you want it to feel like',
      'A personalized cleansing ritual built for your home, using intention, symbolism, and selected aromatic and botanical elements',
      'Attention to thresholds, corners, and the rooms that carry the most weight',
      'A blessing spoken over the home to close, and simple practices you can repeat yourself to keep the space feeling like yours',
    ],
    process: [
      'Reach out through the contact page and tell Amber about the home and the moment you are in.',
      'Together you arrange the visit — timing, the shape of the ritual, and what to prepare.',
      'Amber comes to your home and leads the cleansing and blessing; you are welcome to take part in every step.',
    ],
    goodToKnow: [
      'A spiritual service only — not a cleaning, medical, or remediation service, and no claim is made that it removes disease, toxins, or objectively measurable entities.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['aura-cleansing', 'spirit-resolution', 'protections'],
  },
  {
    slug: 'spirit-resolution',
    title: 'Spirit Resolution',
    eyebrow: 'Space & Spirit Work · Salt Lake City',
    metaDescription:
      'Spirit resolution in Salt Lake City, Utah — calm, grounded spiritual support for homes and people experiencing a heaviness or presence they cannot shake. A ritual of intention, prayer, and clearing with Amber.',
    catalogHandle: null,
    image: 'spirit-resolution.webp',
    imageAlt:
      'Golden hands cupping light within sacred geometry — owner-supplied illustration for Spirit Resolution',
    interestCategory: 'readings',
    deliveryNote:
      'Begins with a conversation; in-person work is in Salt Lake City and along the Wasatch Front.',
    intro: [
      'Sometimes a place — or a stretch of life — carries a heaviness that ordinary tidying does not touch: a room nobody wants to sit in, a house with a history, a feeling of being accompanied that you did not invite. Like a pond that will not settle, the surface keeps rippling long after anything visible has passed. Spirit resolution is the apothecary’s answer to that feeling: calm, grounded spiritual work aimed at helping a space, and the people in it, come back to still water.',
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
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['house-cleansing', 'protections', 'mediumship'],
  },
  {
    slug: 'protections',
    title: 'Protections & Wardings',
    eyebrow: 'Protection Work · Salt Lake City & Online',
    metaDescription:
      'Protection work and wardings with Amber in Salt Lake City, Utah and online — spiritual protections for people, homes, and new ventures: a hedge around the garden, a gate latched with intention.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Protections and wardings illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Begins with a conversation; home wardings are in person in Salt Lake City and along the Wasatch Front, personal protections can be prepared remotely.',
    intro: [
      'A good gardener does not wait for the deer to find the roses — she plants a hedge. Protection work is the spiritual version of that hedge: deliberate ritual, symbolism, and spoken intention set around a person, a home, or a new venture, the way you would latch a gate at night or draw a circle of light around what you love.',
      'People ask for protections at thresholds: moving into a new home, starting a business, sending a child into a hard season, walking away from someone who has wished them ill, or simply feeling exposed in a way they cannot name. Amber builds each working personally — drawing on the apothecary’s botanical tradition, prayer, and symbol — and teaches you how to tend the hedge yourself afterward, because a protection you understand is one you can keep.',
    ],
    includes: [
      'A conversation first — what feels exposed, and what you want guarded',
      'A personalized protection ritual or warding, built for the person, home, or venture at hand',
      'Botanical and symbolic elements chosen for the work — and explained, so nothing is a mystery to you',
      'Simple upkeep practices: how to refresh the warding and keep the boundary strong',
    ],
    process: [
      'Reach out through the contact page and share the situation in whatever words you have.',
      'Amber talks it through with you and proposes an approach; nothing begins until it feels right to you.',
      'The working itself — in person for homes in Salt Lake City and along the Wasatch Front, or prepared and guided remotely for personal protections.',
    ],
    goodToKnow: [
      'Protection begins with the practical — locks, light, boundaries, and good counsel — and this work is the spiritual layer alongside those things, never instead of them. If a situation involves real danger, Amber will say so plainly and point you to help first.',
      'A spiritual and symbolic practice; outcomes are not guaranteed, and no claim is made of measurable effects.',
      'This service is offered on trust — I ask only for what you can pay, with integrity. Reach out and we will arrange everything personally.',
    ],
    relatedSlugs: ['house-cleansing', 'spirit-resolution', 'aura-cleansing'],
  },
  {
    slug: 'ceremonies',
    title: 'Ceremonies for Every Threshold',
    eyebrow: 'Ceremonies & Rites · Salt Lake City & the Wasatch Front',
    metaDescription:
      'Ceremonies of every sort with Amber in Salt Lake City, Utah — weddings and handfastings, baby blessings, memorials, moon and seasonal rites, and release ceremonies: every doorway of a life, marked with intention.',
    catalogHandle: null,
    image: null,
    imageAlt: 'Ceremonies illustration',
    interestCategory: 'readings',
    deliveryNote:
      'Ceremonies are designed personally with Amber — begin with a free consultation call, and we will shape yours together.',
    intro: [
      'A life is a hallway of doorways: births, unions, partings, new homes, new names, last goodbyes. Crossed without ceremony, a doorway is just a door walked through in the dark. Ritual is how we turn the light on — how we say, out loud and together, this moment matters, and we crossed it on purpose.',
      'Amber designs and leads ceremonies of every sort, built from the ground up around the people crossing the threshold: your beliefs, your symbols, your words woven with the apothecary’s botanical tradition. No templates, no scripts read at you — a rite that sounds like you, smells like the season it happens in, and stays with everyone who stood in it.',
    ],
    includes: [
      'Weddings and handfastings — unions blessed and witnessed in your own tradition’s language',
      'Naming and baby blessings, for the smallest travelers arriving among us',
      'Memorials and goodbye rites, for honoring the dead and loosening grief’s knot with love',
      'Moon and seasonal ceremonies — solstice, equinox, and the turning points of the year',
      'Rites of passage: coming of age, new homes, new ventures, new chapters of every kind',
      'Release and bond-breaking ceremonies, for cords that need cutting cleanly and kindly',
    ],
    process: [
      'Start with a free consultation call — tell Amber what threshold you are standing at.',
      'Together you design the ceremony: who is there, what is said, what is carried, burned, planted, or poured.',
      'On the day, Amber leads the rite and holds the space, so you can simply be inside the moment.',
    ],
    goodToKnow: [
      'If your rite carries legal weight — a marriage, for instance — we will talk honestly about the legal steps that belong alongside the ceremony, well in advance, so the paperwork never shadows the day.',
      'Every ceremony is built personally; size, setting, and season all shape the design. Reach out early for dates at the turning points of the year.',
      'This service is offered on trust — I ask only for what you can pay, with integrity; for larger gatherings we will talk honestly, in advance, about practical costs like travel and supplies.',
    ],
    relatedSlugs: ['mediumship', 'house-cleansing', 'spiritual-guidance'],
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
      'Behind the apothecary is a systems practice — every garden needs its trellis. Amber’s background is enterprise systems, operations, and automation, and this offering puts that side of the house to work for other small businesses: the unglamorous, essential work of setting a business up so it runs clean from the start.',
      'This is for the maker, healer, or founder who has the craft down and a tangle everywhere else — registrations half-finished, tools that do not talk to each other, a presence online that does not match the quality of the work. We sort the tangle into a structure you can actually run, the way you would sort a workbench before the real work begins.',
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
