import { isAbsolute } from 'node:path';

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV !== 'production') return config;
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'CORS_ORIGINS', 'SCREENSHOT_STORAGE_PATH', 'METRICS_TOKEN'];
  for (const key of required) if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error(`${key} is required in production`);
  if (String(config.JWT_ACCESS_SECRET).length < 32) throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  if (String(config.METRICS_TOKEN).length < 24) throw new Error('METRICS_TOKEN must contain at least 24 characters');
  if (!String(config.DATABASE_URL).startsWith('mysql://')) throw new Error('DATABASE_URL must use MySQL');
  if (!isAbsolute(String(config.SCREENSHOT_STORAGE_PATH))) throw new Error('SCREENSHOT_STORAGE_PATH must be absolute in production');
  for (const origin of String(config.CORS_ORIGINS).split(',')) { let url: URL; try { url = new URL(origin.trim()); } catch { throw new Error('CORS_ORIGINS contains an invalid URL'); } if (url.protocol !== 'https:') throw new Error('CORS_ORIGINS must use HTTPS in production'); }
  if (/change_me|replace|generate-/i.test(String(config.DATABASE_URL) + String(config.JWT_ACCESS_SECRET) + String(config.METRICS_TOKEN))) throw new Error('Production secrets must not use example values');
  return config;
}
