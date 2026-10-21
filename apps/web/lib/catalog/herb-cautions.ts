/**
 * Per-herb cautions (Fix-All Stage 4, audit R-21).
 *
 * The herb dataset historically carried benefits and NO safety field.
 * This overlay populates the optional `caution` field ONLY for herbs
 * among the 29 canonical HERB_INDEX entries, and ONLY where text
 * already in this repo states a caution naming that herb. Every value
 * below is a near-verbatim lift from the cited in-repo source (a
 * product record's warnings/allergens text, or the quiz engine's ally
 * note) — nothing here is new medical content, and no herb outside
 * the 29 is populated.
 *
 * Herbs among the 29 with no sourced caution naming them stay absent
 * from this map and render nothing: valerian, passionflower,
 * lemon-balm, ashwagandha, rhodiola, holy-basil, eleuthero,
 * elderberry, astragalus, reishi, turmeric, rose, hibiscus, ginger,
 * vitex (chasteberry), red-raspberry, shatavari, frankincense,
 * blue-lotus.
 *
 * The generated herb shards (lib/catalog/herbs-data/part-*.ts) are
 * not hand-edited; lib/catalog/herbs.ts applies this overlay when it
 * assembles the public HERBS list.
 */
export const HERB_CAUTIONS: Readonly<Record<string, string>> = {
  // Source: lib/catalog/products/rec-dreamease-capsules.ts — warnings.
  mugwort:
    'Contains mugwort and other Asteraceae-family herbs; avoid if sensitive to the daisy/ragweed family.',
  // Source: lib/catalog/products/rec-radiance-support-capsules.ts — warnings.
  chamomile:
    'Contains chamomile (Asteraceae family); those with ragweed-family sensitivities should consult a professional first.',
  // Source: lib/catalog/products/rec-immune-at-ease-capsules.ts — warnings.
  echinacea:
    'Avoid if sensitive to the Asteraceae (daisy) family, which includes echinacea.',
  // Source: lib/catalog/products/rec-soothe-restore-botanical-balm.ts — warnings.
  arnica:
    "Do not use during pregnancy or while breastfeeding without consulting a qualified professional — formula contains comfrey, arnica, and St. John's wort, not established as safe for pregnancy in source materials.",
  // Source: lib/catalog/products/rec-soothe-restore-botanical-balm.ts — warnings.
  comfrey: 'Contains comfrey: external use only.',
  // Source: lib/catalog/products/rec-soothe-restore-botanical-balm.ts — warnings.
  cayenne:
    'Contains cayenne and peppermint — wash hands after use and avoid contact with eyes, mucous membranes, and sensitive areas.',
  // Source: lib/catalog/products/rec-vital-flow-capsules.ts — warnings.
  peppermint:
    'Avoid if sensitive to peppermint or if advised to avoid stimulating digestive herbs.',
  // Source: lib/quiz/quiz.ts — Willow bark ally note (verbatim).
  'white-willow':
    'Traditionally used by herbalists for everyday aches; check with your healthcare provider if you take blood thinners.',
  // Source: lib/catalog/products/rec-radiance-renewal-balm.ts — allergens
  // (family-level caution naming calendula).
  calendula:
    'Formula includes Asteraceae-family botanicals (calendula, chamomile, chrysanthemum); those with ragweed-family sensitivities should patch test.',
  // Source: lib/catalog/products/rec-root-scalp-revival-serum.ts — allergens
  // (family-level caution naming fennel).
  fennel:
    'Formula includes Asteraceae-family botanicals (arnica, chamomile, calendula, chrysanthemum) and Apiaceae-family botanicals (dill, caraway, cumin, coriander, fennel); those with related sensitivities should patch test.',
};
