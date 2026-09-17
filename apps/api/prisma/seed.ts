import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const db = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (minimum 12 characters).');
  }
  const organization = await db.organization.upsert({
    where: { slug: process.env.SEED_ORGANIZATION_SLUG ?? 'default' },
    update: {},
    create: { name: process.env.SEED_ORGANIZATION_NAME ?? 'Default Organization', slug: process.env.SEED_ORGANIZATION_SLUG ?? 'default' },
  });
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      displayName: process.env.SEED_ADMIN_NAME ?? 'System Administrator',
      role: 'ADMIN',
      organizationId: organization.id,
    },
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
