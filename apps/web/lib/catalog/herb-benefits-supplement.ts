/**
 * Per-herb benefit supplements (Herbal Index Phase 1, Batch 01 —
 * records 1–24 of lib/catalog/herbs-data/part-1.ts; owner-approved
 * 2026-10-23).
 *
 * Benefits 1–3 on every record are the owner's apothecary archive
 * text and are NOT touched. This overlay supplies benefits 4–5 ONLY,
 * each one written to the Phase 1 sourcing standard (plan
 * herbal-index-completion-plan-2026-10-23.md §3.2): traditional-use
 * register, support language only, no disease-treatment claims, no
 * dosage — and each benefit paired to a named source that also
 * appears in the record's references (lib/catalog/herb-references.ts).
 * The batch source log (herb → benefit → source) is the approved
 * draft: files/herbal-phase1/batch-01-overlay.md in the migration
 * goal files.
 *
 * The generated herb shards are not hand-edited; lib/catalog/herbs.ts
 * applies this overlay when it assembles the public HERBS list, the
 * same pattern as HERB_CAUTIONS. Records absent from this map keep
 * exactly the benefits their shard carries.
 */
export const HERB_BENEFITS_SUPPLEMENT: Readonly<
  Record<string, readonly [string, string]>
> = {
  // Benefit 4 source: Commission E monograph, Lavandulae flos
  // Benefit 5 source: Commission E monograph, Lavandulae flos (balneotherapy use)
  'lavender': ['Used in Western herbalism for nervous stomach and flatulence', 'Traditionally used in baths to support functional circulation'],
  // Benefit 4 source: EU herbal monograph on Matricariae flos, EMA/HMPC
  // Benefit 5 source: EU herbal monograph on Matricariae flos, EMA/HMPC
  'chamomile': ['Traditionally used to support minor skin and mouth comfort', 'A traditional remedy for common-cold symptoms'],
  // Benefit 4 source: EU herbal monograph on Valerianae radix, EMA/HMPC (well-established use)
  // Benefit 5 source: WHO Monographs on Selected Medicinal Plants, Vol. 1, Radix Valerianae
  'valerian': ['Traditionally used to support relief of daytime nervous tension', 'Used in Western herbalism for nervous gastrointestinal cramps'],
  // Benefit 4 source: WHO Monographs on Selected Medicinal Plants, Vol. 3, Herba Passiflorae
  // Benefit 5 source: Felter & Lloyd, King's American Dispensatory, Passiflora
  'passionflower': ['Traditionally used to support a settled nervous stomach', 'Used in Eclectic herbalism for neuralgic pains with tension'],
  // Benefit 4 source: EU herbal monograph on Melissae folium, EMA/HMPC
  // Benefit 5 source: ESCOP monograph, Melissae folium
  'lemon-balm': ['Used in Western herbalism for bloating and flatulence', 'Traditionally used topically to support cold-sore care'],
  // Benefit 4 source: British Herbal Pharmacopoeia, Artemisia vulgaris (as summarised in the review below)
  // Benefit 5 source: British Herbal Pharmacopoeia, Artemisia vulgaris; PROSEA, *Artemisia vulgaris*
  // Sourcing note (batch log): no EMA/ESCOP monograph exists and Commission E (1988) assessed mugwort negatively; Benefits 4–5 rest on British Herbal Pharmacopoeia attestation via the cited review plus PROSEA. The safety reference in herb-references.ts carries that status.
  'mugwort': ['Traditionally used as a bitter to support poor appetite', 'A traditional remedy used as a vermifuge for intestinal worms'],
  // Benefit 4 source: Emboden, "The Sacred Narcotic Water Lily of the Nile" / "The Sacred Journey in Dynastic Egypt" (1989)
  // Benefit 5 source: Emboden (1989), summarising Egyptian iconography/texts; Bertol et al., *Nymphaea* cults in ancient Egypt and the New World (2004)
  // Sourcing note (batch log): no pharmacopoeia or Western monograph exists; Benefits 4–5 rest on scholarly Egyptology/ethnobotany (Emboden; Bertol et al.; Dosoky et al.). POWO accepts Nymphaea nouchali var. caerulea — the record name is its synonym; the accepted name appears in this record's references only (display names unchanged).
  'blue-lotus': ['Traditionally steeped in wine as a ritual banquet beverage in ancient Egypt', 'Traditionally regarded as an aphrodisiac in ancient Egyptian practice'],
  // Benefit 4 source: Felter & Lloyd, *King's American Dispensatory* (1898), Scutellaria entry
  // Benefit 5 source: Health Canada traditional-use approval, as summarised in the American Botanical Council herb profile; British Herbal Compendium listing for premenstrual tension and period pain
  'skullcap': ['Traditionally used as an antispasmodic to support relief of nervous twitching and tremor', 'Traditionally used to support relief of pain associated with menstruation'],
  // Benefit 4 source: WHO Monographs on Selected Medicinal Plants, Vol. 3, Lupuli flos
  // Benefit 5 source: WHO Monographs on Selected Medicinal Plants, Vol. 3, Lupuli flos, traditional-uses section
  'hops': ['Traditionally used as a bitter to support appetite and digestion', 'A traditional remedy used to support relief of abdominal cramps'],
  // Benefit 4 source: Moerman, *Native American Ethnobotany* (1986), as summarised in Flora of North America via SEINet
  // Benefit 5 source: Bocek, B. "Ethnobotany of Costanoan Indians" (1984), via Herbal Academy ethnobotany summary; also Rätsch, *Encyclopedia of Psychoactive Plants*
  // Benefit 5 is a traditional EXTERNAL (wash/decoction) use and is labelled as such in the benefit text, per the approved draft. Commission E historically gave this herb a negative monograph and is never cited as support.
  'california-poppy': ['A traditional remedy in California Native practice for toothache', 'Traditionally used as a flower decoction for head lice in Costanoan practice (traditional external/wash use)'],
  // Benefit 4 source: WHO Monographs, Vol. 4, Radix Withaniae; PMC review of *W. somnifera* traditional tonic use
  // Benefit 5 source: WHO Monographs, Vol. 4, Radix Withaniae, traditional uses (incl. impotency); Ayurvedic Pharmacopoeia of India, Asvagandha entry
  // A WHO monograph exists (Vol. 4, Radix Withaniae — not Vol. 3); EMA/HMPC formally could not establish an EU monograph and none is claimed. The WHO entry's hosted-copy URL is carried with its unverified marking.
  'ashwagandha': ['Used in Ayurvedic practice as a rasayana (rejuvenative) tonic to support vitality and longevity', 'Used in Ayurvedic practice as a vajikarana to support reproductive vitality'],
  // Benefit 4 source: Brown, R.P., Gerbarg, P.L. & Ramazanov, Z. "Rhodiola rosea: A Phytomedicinal Overview," *HerbalGram* (2002)
  // Benefit 5 source: Panossian, Wikman & Sarris (2010), as summarised in the EMA/HMPC Assessment Report on *Rhodiola rosea* L., rhizoma et radix
  'rhodiola': ['Traditionally given in Siberia as a bouquet of roots to couples before marriage, to support fertility', 'A traditional remedy in folk practice for headaches'],
  // Benefit 4 source: WHO, *Radix Eleutherococci*
  // Benefit 5 source: WHO, *Radix Eleutherococci*, traditional-systems uses
  'eleuthero': ['Traditionally used to support recovery during convalescence', 'Traditionally used to support sleep when rest is dream-disturbed'],
  // Benefit 4 source: Gonzales (2012)
  // Benefit 5 source: Gonzales (2012); Frontiers in Pharmacology review (2024)
  'maca': ['A traditional Andean food used to support everyday nutrition', 'Traditionally consumed at high altitude to support resilience in mountain life'],
  // Benefit 4 source: Health Canada monograph, citing PPRC (2020)
  // Benefit 5 source: Health Canada, *Panax quinquefolius* monograph
  // Commission E / WHO Radix Ginseng monographs cover Panax ginseng, NOT this species, and are deliberately not cited. The PPRC entry is cited via Health Canada and keeps its unverified marking.
  'ginseng': ['Used in TCM practice to nourish yin and support fluids for dry mouth and thirst', 'Traditionally used to help relieve restlessness and nervousness'],
  // Benefit 4 source: Chinese Pharmacopoeia, as summarised in PMC lignan review (2022)
  // Benefit 5 source: Chinese Pharmacopoeia, as summarised in PMC lignan review (2022)
  'schisandra': ['Used in TCM as an astringent to support the lungs in chronic cough', 'Traditionally used in TCM to calm the spirit and support restful sleep'],
  // Benefit 4 source: LactMed summary via Drugs.com (malunggay tradition, Philippines)
  // Benefit 5 source: Singh et al. (2021), summarising Shigru in Ayurveda
  'moringa': ['A traditional leaf food used to support nursing mothers', 'Used in Ayurvedic practice to support the eyes'],
  // Benefit 4 source: EMA/HMPC monograph, Camelliae sinensis non fermentatum folium
  // Benefit 5 source: Springer review, "Tea beyond the cup" (2025), traditional-uses section
  'green-tea': ['Traditionally used to support relief of fatigue and a sensation of weakness', 'Traditionally used in Chinese practice to support digestion after heavy, greasy meals'],
  // Benefit 4 source: EMA/HMPC peppermint oil monograph, traditional use internally and externally for coughs and colds
  // Benefit 5 source: EMA/HMPC peppermint oil monograph, traditional external use
  'peppermint': ['Traditionally used for coughs and colds', 'Used in Western herbalism for localised muscle pain and itching of intact skin (oil, external use)'],
  // Benefit 4 source: EMA/HMPC ginger rhizome monograph
  // Benefit 5 source: EMA/HMPC ginger rhizome monograph, Revision 1 traditional-use indications
  'ginger': ['Traditionally used to support comfort in motion sickness', 'Traditionally used for relief of symptoms of the common cold'],
  // Benefit 4 source: EMA/HMPC liquorice root monograph, traditional-use Indication 2
  // Benefit 5 source: WHO monograph on liquorice root, as summarised in the PMC comprehensive review of *Glycyrrhiza glabra*
  // Safety pairing is material for this record: the NCCIH glycyrrhizin caution is in this record's references; the AHPA Handbook entry could not be page-verified and is carried as unverified.
  'licorice': ['Traditionally used as an expectorant in cough associated with cold', 'A traditional demulcent remedy for sore throats'],
  // Benefit 4 source: EMA/HMPC Sambuci flos monograph; WHO elder flower monograph as summarised in reviews
  // Benefit 5 source: PMC ethnopharmacological review of *Sambucus nigra*
  // Benefit 4 is elderFLOWER (the EMA monograph covers the flower only) and is labelled flower-not-berry in the text; Benefit 5 is the berry tradition (cooked syrups/juices) sourced to the cited PMC review. The flower monograph is never merged into berry claims.
  'elderberry': ['Elderflower (flower, not berry): traditionally used as a diaphoretic tea at the onset of colds', 'Berry: traditionally prepared as cooked syrups and juices as a winter folk remedy for feverish, catarrhal conditions'],
  // Benefit 4 source: German Commission E monograph on *Echinacea purpurea* herb, external use
  // Benefit 5 source: Kindscher, The Uses of Echinacea angustifolia and Other Echinacea Species by Native Americans — see species caveat in Notes
  // Benefit 5's Plains tradition is best documented for E. angustifolia; the text is worded at Echinacea-tradition level with that caveat. Benefit 4 (Commission E external use) is E. purpurea-specific.
  'echinacea': ['Used in Western herbalism externally to support poorly healing wounds', 'A traditional Plains remedy for toothache and sore throat pain'],
  // Benefit 4 source: Chinese Pharmacopoeia Astragali Radix tradition, as summarised in the PMC Huangqi review and the Frontiers review table
  // Benefit 5 source: Chen & Chen, Chinese Medical Herbology and Pharmacology, Huang Qi entry and Yu Ping Feng San formula monograph
  'astragalus': ['Used in Chinese medicine as a qi tonic to support people with fatigue and poor appetite', 'Traditionally used in Chinese medicine for spontaneous sweating from exterior (wei qi) deficiency'],
};
