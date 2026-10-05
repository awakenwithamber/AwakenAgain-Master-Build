/**
 * GENERATED — do not hand-edit. Re-run `node scripts/port-catalog.mjs`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: 2026-10-05
 */
import type { Product } from '../../../types';
import { RECORD as rec_radiance_renewal_balm } from './rec-radiance-renewal-balm';
import { RECORD as rec_radiance_support_capsules } from './rec-radiance-support-capsules';
import { RECORD as rec_root_scalp_revival_serum } from './rec-root-scalp-revival-serum';
import { RECORD as rec_soothe_restore_botanical_balm } from './rec-soothe-restore-botanical-balm';
import { RECORD as rec_gentle_detox_ritual } from './rec-gentle-detox-ritual';
import { RECORD as rec_focus_clarity_ritual } from './rec-focus-clarity-ritual';
import { RECORD as rec_full_soap_collection } from './rec-full-soap-collection';
import { RECORD as rec_stress_relief_ritual } from './rec-stress-relief-ritual';
import { RECORD as rec_chill_pill_capsules } from './rec-chill-pill-capsules';
import { RECORD as rec_dreamease_capsules } from './rec-dreamease-capsules';
import { RECORD as rec_environmental_wellness_support } from './rec-environmental-wellness-support';
import { RECORD as rec_happy_pill_capsules } from './rec-happy-pill-capsules';
import { RECORD as rec_immune_at_ease_capsules } from './rec-immune-at-ease-capsules';
import { RECORD as rec_metabolic_wellness_formula } from './rec-metabolic-wellness-formula';
import { RECORD as rec_sacred_balance_capsules } from './rec-sacred-balance-capsules';
import { RECORD as rec_seasonal_gut_reset } from './rec-seasonal-gut-reset';
import { RECORD as rec_vital_connect_capsules } from './rec-vital-connect-capsules';
import { RECORD as rec_vital_flow_capsules } from './rec-vital-flow-capsules';
import { RECORD as rec_vital_vitality_capsules } from './rec-vital-vitality-capsules';
import { RECORD as rec_wild_caught_omega_3_fish_oil } from './rec-wild-caught-omega-3-fish-oil';
import { RECORD as rec_custom_herbal_capsules } from './rec-custom-herbal-capsules';
import { RECORD as rec_custom_remedy_consultation } from './rec-custom-remedy-consultation';
import { RECORD as rec_personalized_herbal_protocols } from './rec-personalized-herbal-protocols';
import { RECORD as rec_grimoire_subscription } from './rec-grimoire-subscription';
import { RECORD as rec_tarot_readings } from './rec-tarot-readings';
import { RECORD as rec_energy_work } from './rec-energy-work';
import { RECORD as rec_home_aura_space_cleansing } from './rec-home-aura-space-cleansing';
import { RECORD as rec_hypnotherapy_guided_relaxation } from './rec-hypnotherapy-guided-relaxation';
import { RECORD as rec_past_life_inspired_guided_exploration } from './rec-past-life-inspired-guided-exploration';
import { RECORD as rec_personalized_botanical_consultation } from './rec-personalized-botanical-consultation';
import { RECORD as rec_rune_readings } from './rec-rune-readings';
import { RECORD as rec_tarot_rune_reading } from './rec-tarot-rune-reading';
import { RECORD as rec_citrus_goddess_glow_soap } from './rec-citrus-goddess-glow-soap';
import { RECORD as rec_custom_botanical_soap } from './rec-custom-botanical-soap';
import { RECORD as rec_eucalyptus_mint_spa_renewal_soap } from './rec-eucalyptus-mint-spa-renewal-soap';
import { RECORD as rec_fresh_mountain_air_soap } from './rec-fresh-mountain-air-soap';
import { RECORD as rec_gaias_rose_soap } from './rec-gaias-rose-soap';
import { RECORD as rec_lavender_fairy_dream_soap } from './rec-lavender-fairy-dream-soap';
import { RECORD as rec_orange_lily_goddess_soap } from './rec-orange-lily-goddess-soap';
import { RECORD as rec_sacred_forest_ritual_soap } from './rec-sacred-forest-ritual-soap';
import { RECORD as rec_sunlit_garden_bloom_soap } from './rec-sunlit-garden-bloom-soap';
import { RECORD as rec_warm_cinnamon_comfort_soap } from './rec-warm-cinnamon-comfort-soap';
import { RECORD as rec_alchemy_tea_blend } from './rec-alchemy-tea-blend';
import { RECORD as rec_custom_tea_blends } from './rec-custom-tea-blends';
import { RECORD as rec_soap_style_collection_5 } from './rec-soap-style-collection-5';

export const CATALOG_PROVENANCE = {
  source: 'products.canonical.v3.json',
  recordCount: 45,
  generatedAt: '2026-10-05T23:08:13.352Z',
  status: 'PROPOSED',
} as const;

export const PRODUCTS: Product[] = [
  rec_radiance_renewal_balm,
  rec_radiance_support_capsules,
  rec_root_scalp_revival_serum,
  rec_soothe_restore_botanical_balm,
  rec_gentle_detox_ritual,
  rec_focus_clarity_ritual,
  rec_full_soap_collection,
  rec_stress_relief_ritual,
  rec_chill_pill_capsules,
  rec_dreamease_capsules,
  rec_environmental_wellness_support,
  rec_happy_pill_capsules,
  rec_immune_at_ease_capsules,
  rec_metabolic_wellness_formula,
  rec_sacred_balance_capsules,
  rec_seasonal_gut_reset,
  rec_vital_connect_capsules,
  rec_vital_flow_capsules,
  rec_vital_vitality_capsules,
  rec_wild_caught_omega_3_fish_oil,
  rec_custom_herbal_capsules,
  rec_custom_remedy_consultation,
  rec_personalized_herbal_protocols,
  rec_grimoire_subscription,
  rec_tarot_readings,
  rec_energy_work,
  rec_home_aura_space_cleansing,
  rec_hypnotherapy_guided_relaxation,
  rec_past_life_inspired_guided_exploration,
  rec_personalized_botanical_consultation,
  rec_rune_readings,
  rec_tarot_rune_reading,
  rec_citrus_goddess_glow_soap,
  rec_custom_botanical_soap,
  rec_eucalyptus_mint_spa_renewal_soap,
  rec_fresh_mountain_air_soap,
  rec_gaias_rose_soap,
  rec_lavender_fairy_dream_soap,
  rec_orange_lily_goddess_soap,
  rec_sacred_forest_ritual_soap,
  rec_sunlit_garden_bloom_soap,
  rec_warm_cinnamon_comfort_soap,
  rec_alchemy_tea_blend,
  rec_custom_tea_blends,
  rec_soap_style_collection_5,
];

export function getProductByHandle(handle: string): Product | undefined {
  return PRODUCTS.find((p) => p.handle === handle);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}
