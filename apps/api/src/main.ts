import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { JsonLogger } from './observability/json-logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: new JsonLogger() });
  app.disable('x-powered-by'); app.enableShutdownHooks();
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0); if (proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use(helmet({ hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false }));
  app.use(json({ limit: '1mb' }), urlencoded({ extended: false, limit: '100kb' }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  await app.listen(Number(process.env.PORT ?? 4000), process.env.HOST ?? '0.0.0.0');
}
void bootstrap();
