/**
 * Apothecary Journal articles (G7).
 *
 * Ported from the legacy static journal section — these are the owner's
 * published editorial articles, carried forward verbatim in substance
 * (light edits for accuracy only). No new health claims added.
 * Status: CURRENT editorial content (legacy-published).
 */
export interface JournalArticle {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  paragraphs: string[];
  wisdom: string;
  keyHerbs: string[];
  publishedNote: string;
}

export const JOURNAL_ARTICLES: readonly JournalArticle[] = [
  {
    slug: 'the-hidden-power-of-mugwort',
    tag: 'Sleep & Dreams',
    title: 'The Hidden Power of Mugwort',
    excerpt:
      'Sacred to the moon and used by herbalists for centuries, mugwort holds a unique place in the plant kingdom.',
    paragraphs: [
      'Sacred to the moon and used by herbalists for centuries, mugwort holds a unique place in the plant kingdom. Known as the "dream herb," it has been used across cultures — from Native American traditions to European folk medicine — to enhance dream recall, promote lucid dreaming, and deepen the connection between the waking mind and the subconscious.',
    ],
    wisdom: 'The plants that grow in darkness often carry the most light.',
    keyHerbs: ['Mugwort', 'Blue Lotus', 'Passionflower'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
  {
    slug: 'herbs-for-restful-sleep',
    tag: 'Nervous System',
    title: 'Herbs for Restful Sleep',
    excerpt:
      'Traditional herbalism has long recognized a family of plants called nervines — herbs that nourish, calm, and restore the nervous system.',
    paragraphs: [
      'In a world of overstimulation, the nervous system craves stillness. Traditional herbalism has long recognized a family of plants called nervines — herbs that nourish, calm, and restore the nervous system. Valerian, passionflower, chamomile, and lemon balm each offer a distinct quality of rest: some deepen sleep, others quiet the mind, and some gently ease the transition from waking to dreaming.',
    ],
    wisdom: 'Rest is not idleness. It is the soil in which healing grows.',
    keyHerbs: ['Valerian', 'Chamomile', 'Passionflower', 'Lemon Balm'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
  {
    slug: 'the-wisdom-of-adaptogenic-plants',
    tag: 'Adaptogens',
    title: 'The Wisdom of Adaptogenic Plants',
    excerpt:
      'Adaptogens are among the most remarkable plants in the herbal world — herbs that help the body adapt to stress by bringing it into balance.',
    paragraphs: [
      'Adaptogens are among the most remarkable plants in the herbal world. These are herbs that help the body adapt to stress — not by sedating it, not by stimulating it, but by bringing it into balance. Ashwagandha, rhodiola, holy basil, and eleuthero each work through different pathways to regulate the stress response, support the adrenal glands, and restore resilience at the cellular level.',
    ],
    wisdom: 'The strongest trees grow in the most challenging soil.',
    keyHerbs: ['Ashwagandha', 'Rhodiola', 'Holy Basil', 'Eleuthero'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
  {
    slug: 'ancient-herbal-rituals-for-healing',
    tag: 'Ancient Rituals',
    title: 'Ancient Herbal Rituals for Healing',
    excerpt:
      'Long before pharmacies, there were apothecaries. Long before apothecaries, there were healers who walked into the forest and listened.',
    paragraphs: [
      'Long before pharmacies, there were apothecaries. Long before apothecaries, there were healers who walked into the forest and listened. Every culture on earth developed its own relationship with medicinal plants — the Ayurvedic tradition of India, the herbalism of ancient Egypt, the plant medicine of Indigenous peoples across the Americas. These traditions share a common thread: the belief that healing is a conversation between the human body and the living world.',
    ],
    wisdom: 'Wherever you are, and whatever you do, be in love. — Rumi',
    keyHerbs: ['Frankincense', 'Turmeric', 'Ashwagandha', 'Reishi'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
  {
    slug: 'immune-boosting-plants-from-ancient-traditions',
    tag: 'Immune Wisdom',
    title: 'Immune Boosting Plants from Ancient Traditions',
    excerpt:
      'The immune system is not a wall — it is a living intelligence. Traditional herbalism has always understood this.',
    paragraphs: [
      'The immune system is not a wall — it is a living intelligence. Traditional herbalism has always understood this. Rather than simply "boosting" immunity, the wisest herbal traditions speak of modulating, nourishing, and educating the immune response. Elderberry, astragalus, echinacea, and reishi mushroom each work in distinct ways — some stimulate, some regulate, some build deep immune reserves over time.',
    ],
    wisdom: 'The body has the wisdom to heal itself when given the right allies.',
    keyHerbs: ['Elderberry', 'Astragalus', 'Echinacea', 'Reishi'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
  {
    slug: 'natural-pain-relief-through-plant-medicine',
    tag: 'Natural Pain Relief',
    title: 'Natural Pain Relief Through Plant Medicine',
    excerpt:
      'Pain is the body\u2019s language — a signal, not a sentence. Traditional herbalism approaches pain by addressing the underlying imbalance.',
    paragraphs: [
      'Pain is the body\u2019s language — a signal, not a sentence. Traditional herbalism approaches pain not by silencing the signal, but by addressing the underlying inflammation, tension, or imbalance that creates it. Arnica, turmeric, willow bark, and cayenne each offer distinct mechanisms: some cool inflammation, some increase circulation, some interrupt the pain signal at the nerve level — all without the side effects of pharmaceutical intervention.',
    ],
    wisdom: 'These pains you feel are messengers. Listen to them. — Rumi',
    keyHerbs: ['Arnica', 'Turmeric', 'Willow Bark', 'Cayenne', 'Comfrey'],
    publishedNote: 'Originally published in the legacy Apothecary Journal.',
  },
];

export function getArticle(slug: string): JournalArticle | undefined {
  return JOURNAL_ARTICLES.find((a) => a.slug === slug);
}
