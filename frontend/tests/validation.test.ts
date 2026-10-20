import { describe, expect, it } from 'vitest';
import {
  MESSAGE_MAX_LENGTH,
  validateEmail,
  validateMessage,
  validatePassword,
  validatePasswordConfirmation,
} from '../src/lib/validation';

describe('validation — email', () => {
  it('accepte une adresse email valide', () => {
    expect(validateEmail('rakoto@example.mg')).toBeUndefined();
  });

  it('refuse une adresse vide', () => {
    expect(validateEmail('  ')).toMatch(/requise/i);
  });

  it('refuse une adresse invalide', () => {
    expect(validateEmail('pas-un-email')).toMatch(/valide/i);
  });
});

describe('validation — mot de passe', () => {
  it('accepte un mot de passe conforme', () => {
    expect(validatePassword('MotDePasse1')).toBeUndefined();
  });

  it('refuse un mot de passe trop court', () => {
    expect(validatePassword('Ab1')).toMatch(/8 caractères/i);
  });

  it('refuse un mot de passe sans majuscule', () => {
    expect(validatePassword('motdepasse1')).toMatch(/majuscule/i);
  });

  it('refuse un mot de passe sans chiffre', () => {
    expect(validatePassword('MotDePasse')).toMatch(/chiffre/i);
  });

  it('refuse une confirmation différente', () => {
    expect(validatePasswordConfirmation('MotDePasse1', 'MotDePasse2')).toMatch(
      /ne correspondent pas/i,
    );
  });

  it('accepte une confirmation identique', () => {
    expect(validatePasswordConfirmation('MotDePasse1', 'MotDePasse1')).toBeUndefined();
  });
});

describe('validation — message', () => {
  it('refuse un message vide', () => {
    expect(validateMessage('   ')).toMatch(/vide/i);
  });

  it('refuse un message trop long', () => {
    expect(validateMessage('a'.repeat(MESSAGE_MAX_LENGTH + 1))).toMatch(/dépasser/i);
  });

  it('accepte un message normal', () => {
    expect(validateMessage('Salut !')).toBeUndefined();
  });
});
