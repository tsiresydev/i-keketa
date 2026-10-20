import { describe, expect, it } from 'vitest';
import { generatePseudonym, isMessageContentSafe, sanitizeText } from '../../src/utils/text';

const NULL_CHAR = String.fromCharCode(0);
const BELL_CHAR = String.fromCharCode(7);
const RIGHT_TO_LEFT_OVERRIDE = String.fromCharCode(0x202e);
const NON_BREAKING_SPACE = String.fromCharCode(0x00a0);

describe('utils/text', () => {
  describe('sanitizeText', () => {
    it('supprime les caractères de contrôle', () => {
      expect(sanitizeText(`salut${NULL_CHAR}`)).toBe('salut');
      expect(sanitizeText(`salut${BELL_CHAR}`)).toBe('salut');
    });

    it('conserve les retours à la ligne', () => {
      expect(sanitizeText('ligne1\nligne2')).toBe('ligne1\nligne2');
    });

    it('neutralise les caractères de direction bidirectionnelle', () => {
      expect(sanitizeText(`salut${RIGHT_TO_LEFT_OVERRIDE}txet`)).toBe('saluttxet');
    });

    it('normalise les espaces insécables et multiples', () => {
      expect(sanitizeText(`bonjour${NON_BREAKING_SPACE}le   monde`)).toBe('bonjour le monde');
    });
  });

  describe('isMessageContentSafe', () => {
    it('refuse un message vide ou composé uniquement de caractères de contrôle', () => {
      expect(isMessageContentSafe('')).toBe(false);
      expect(isMessageContentSafe(NULL_CHAR)).toBe(false);
    });

    it('accepte un message avec du texte', () => {
      expect(isMessageContentSafe('bonjour')).toBe(true);
    });
  });

  describe('generatePseudonym', () => {
    it('génère un pseudonyme lisible et non vide', () => {
      const pseudonym = generatePseudonym();

      expect(pseudonym.length).toBeGreaterThan(3);
      expect(pseudonym).toMatch(/^[A-Za-zÀ-ÿ]+-[A-Z0-9]{4}$/);
    });

    it('génère des pseudonymes différents', () => {
      const pseudonyms = new Set(Array.from({ length: 50 }, () => generatePseudonym()));

      expect(pseudonyms.size).toBeGreaterThan(1);
    });
  });
});
