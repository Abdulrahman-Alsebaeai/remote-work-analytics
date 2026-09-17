import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('allows development defaults', () => expect(validateEnvironment({ NODE_ENV: 'development' })).toEqual({ NODE_ENV: 'development' }));
  it('rejects incomplete production configuration', () => expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow('DATABASE_URL'));
  it('rejects insecure production origins', () => expect(() => validateEnvironment({ NODE_ENV: 'production', DATABASE_URL: 'mysql://user:strong-password@db/remote_work', JWT_ACCESS_SECRET: 'a-secure-secret-that-is-longer-than-32-characters', CORS_ORIGINS: 'http://manager.example.com', SCREENSHOT_STORAGE_PATH: '/data/screenshots', METRICS_TOKEN: 'a-secure-metrics-token-value' })).toThrow('HTTPS'));
  it('accepts strong production configuration', () => { const config = { NODE_ENV: 'production', DATABASE_URL: 'mysql://user:strong-password@db/remote_work', JWT_ACCESS_SECRET: 'a-secure-secret-that-is-longer-than-32-characters', CORS_ORIGINS: 'https://manager.example.com', SCREENSHOT_STORAGE_PATH: '/data/screenshots', METRICS_TOKEN: 'a-secure-metrics-token-value' }; expect(validateEnvironment(config)).toBe(config); });
});
