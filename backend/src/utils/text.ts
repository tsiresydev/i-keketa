/**
 * Nettoyage du texte utilisateur.
 * - Supprime les caractères de contrôle (sauf retour à la ligne / tabulation).
 * - Normalise les espaces insécables et les espaces multiples.
 * - Supprime les caractères de direction bidirectionnelle (usurpation de texte).
 */
const CONTROL_CHARACTERS = new RegExp(
  '[' +
    '\\u0000-\\u0008' +
    '\\u000B\\u000C' +
    '\\u000E-\\u001F' +
    '\\u007F-\\u009F' +
    '\\u200B-\\u200F' +
    '\\u2028\\u2029' +
    '\\u202A-\\u202E' +
    '\\u2066-\\u2069' +
    '\\uFEFF' +
    ']',
  'g',
);

const NON_BREAKING_SPACE = new RegExp('\\u00A0', 'g');

export const sanitizeText = (value: string): string =>
  value
    .replace(CONTROL_CHARACTERS, '')
    .replace(NON_BREAKING_SPACE, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

export const isMessageContentSafe = (value: string): boolean =>
  value.replace(CONTROL_CHARACTERS, '').trim().length > 0;

/**
 * Génère un identifiant technique anonyme, unique et lisible dans les journaux.
 * Il n'est jamais affiché au partenaire : seul le nom saisi par le visiteur l'est.
 */ const PSEUDONYM_ADJECTIVES = [
  'Curieux',
  'Discret',
  'Enjoué',
  'Kalou',
  'Mety',
  'Ravi',
  'Tsara',
  'Vasiana',
  'Vonona',
  'Zaza',
];

const randomInt = (max: number): number => Math.floor(Math.random() * max);

export const generatePseudonym = (): string => {
  const adjective = PSEUDONYM_ADJECTIVES[randomInt(PSEUDONYM_ADJECTIVES.length)] ?? 'Anonyme';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${adjective}-${suffix}`;
};
