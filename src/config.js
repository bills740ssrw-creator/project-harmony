'use strict';

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  dbPath: process.env.DB_PATH || './data/harmony.sqlite',
  aiProvider: process.env.AI_PROVIDER || 'openai-compatible',
  aiBaseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
  supportedLanguages: ['en', 'hi', 'es', 'fr', 'de', 'pt'],
  appName: process.env.APP_NAME || 'Project Harmony',
  brandPrimary: process.env.BRAND_PRIMARY || '#6366f1',
  countries: ['US', 'IN'],
};
