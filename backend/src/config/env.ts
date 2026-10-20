import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().default(''),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET doit contenir au moins 16 caractères').default(''),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  WS_MESSAGE_RATE_MAX: z.coerce.number().int().positive().default(20),
  WS_MESSAGE_RATE_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1000),
  MESSAGE_MAX_LENGTH: z.coerce.number().int().positive().default(2000),
  USE_IN_MEMORY_DB: booleanFromEnv(false),
  MONGOMS_VERSION: z.string().default('7.0.24'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `- ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Configuration d'environnement invalide :\n${issues}`);
}

const raw = parsed.data;

if (!raw.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET est obligatoire. Copiez backend/.env.example vers backend/.env et renseignez une valeur sécurisée.',
  );
}

if (raw.NODE_ENV === 'production' && raw.JWT_SECRET === 'change-me') {
  throw new Error('JWT_SECRET doit être modifié en production.');
}

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
