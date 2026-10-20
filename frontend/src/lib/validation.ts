/**
 * Validation de formulaire côté client.
 * Règles alignées sur la validation serveur (source de vérité : backend/src/schemas).
 */
export interface FieldErrors {
  [field: string]: string | undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateEmail = (email: string): string | undefined => {
  const value = email.trim();

  if (value.length === 0) {
    return 'L’adresse email est requise.';
  }

  if (!EMAIL_PATTERN.test(value)) {
    return 'L’adresse email doit être valide.';
  }

  return undefined;
};

export const validatePassword = (password: string): string | undefined => {
  if (password.length === 0) {
    return 'Le mot de passe est requis.';
  }

  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre minuscule.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre majuscule.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }

  return undefined;
};

export const validatePasswordConfirmation = (
  password: string,
  confirmation: string,
): string | undefined => {
  if (confirmation.length === 0) {
    return 'Veuillez confirmer votre mot de passe.';
  }

  if (password !== confirmation) {
    return 'Les mots de passe ne correspondent pas.';
  }

  return undefined;
};

export const MESSAGE_MAX_LENGTH = 2000;

export const validateMessage = (content: string): string | undefined => {
  if (content.trim().length === 0) {
    return 'Le message ne peut pas être vide.';
  }

  if (content.length > MESSAGE_MAX_LENGTH) {
    return `Le message ne peut pas dépasser ${MESSAGE_MAX_LENGTH} caractères.`;
  }

  return undefined;
};

/* ---------- Profil (Sprint 2) ---------- */

export const DISPLAY_NAME_MAX_LENGTH = 60;
export const INTEREST_MAX_LENGTH = 30;
export const INTEREST_MAX_COUNT = 10;
export const LOCATION_MAX_LENGTH = 120;

/**
 * Découpe une saisie d'intérêts séparés par des virgules.
 */
export const parseInterests = (value: string): string[] =>
  value
    .split(',')
    .map((interest) => interest.trim())
    .filter((interest) => interest.length > 0);

export const validateDisplayName = (value: string): string | undefined => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length < 2) {
    return 'Le nom doit contenir au moins 2 caractères.';
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Le nom ne peut pas dépasser ${DISPLAY_NAME_MAX_LENGTH} caractères.`;
  }

  return undefined;
};

export const validateInterests = (value: string): string | undefined => {
  const interests = parseInterests(value);

  if (interests.length > INTEREST_MAX_COUNT) {
    return `Maximum ${INTEREST_MAX_COUNT} centres d’intérêt.`;
  }

  const tooLong = interests.find((interest) => interest.length > INTEREST_MAX_LENGTH);

  if (tooLong) {
    return `Un centre d’intérêt ne peut pas dépasser ${INTEREST_MAX_LENGTH} caractères.`;
  }

  return undefined;
};

export const validateLocation = (value: string): string | undefined => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length < 2) {
    return 'La localisation doit contenir au moins 2 caractères.';
  }

  if (trimmed.length > LOCATION_MAX_LENGTH) {
    return `La localisation ne peut pas dépasser ${LOCATION_MAX_LENGTH} caractères.`;
  }

  return undefined;
};
