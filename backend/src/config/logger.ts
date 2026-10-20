/**
 * Journalisation côté serveur uniquement.
 * Les erreurs exposées au client ne doivent jamais contenir de détail interne.
 */
type Level = 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: unknown): void => {
  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta !== undefined ? { meta } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.warn(line);
};

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
