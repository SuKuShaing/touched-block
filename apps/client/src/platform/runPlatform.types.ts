/**
 * Desde dónde se juega: se manda en POST /runs solo para estadística (ver docs/api.md). Debe
 * coincidir con RUN_PLATFORMS de la API (apps/api/src/runs/platform.ts).
 */
export type RunPlatform = 'app_android' | 'app_ios' | 'web_mobile' | 'web_desktop';
