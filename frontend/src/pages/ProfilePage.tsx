import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { FormField } from '../components/FormField';
import { useAuth } from '../hooks/use-auth';
import { profileApi } from '../lib/api-client';
import {
  parseInterests,
  validateDisplayName,
  validateInterests,
  validateLocation,
} from '../lib/validation';

const PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ProfilePage = () => {
  const { user, token, applyUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [interests, setInterests] = useState(user?.interests.join(', ') ?? '');
  const [location, setLocation] = useState(user?.location ?? '');

  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    interests?: string;
    location?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // La photo affichée est celle du serveur tant qu'aucun nouvel envoi n'a lieu.
  const photoUrl = photoPreview ?? user?.photoUrl ?? null;
  const displayNameValue = user?.displayName ?? '';
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  // La session est restaurée de façon asynchrone : le formulaire est pré-rempli
  // dès que l'utilisateur courant est disponible.
  useEffect(() => {
    if (!user || user.id === loadedUserId) {
      return;
    }

    setLoadedUserId(user.id);
    setDisplayName(user.displayName ?? '');
    setInterests(user.interests.join(', '));
    setLocation(user.location ?? '');
  }, [user, loadedUserId]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const errors = {
      displayName: validateDisplayName(displayName),
      interests: validateInterests(interests),
      location: validateLocation(location),
    };

    setFieldErrors(errors);

    if (errors.displayName || errors.interests || errors.location) {
      return;
    }

    if (!token) {
      setFormError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const payload = {
      displayName: displayName.trim(),
      interests: parseInterests(interests),
      location: location.trim(),
    };

    setIsSaving(true);

    try {
      const { user: updatedUser } = await profileApi.update(token, payload);
      applyUser(updatedUser);
      setPhotoPreview(null);
      setNotice('Profil mis à jour.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Mise à jour du profil impossible.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setFormError(null);
    setNotice(null);

    if (!PHOTO_MIME_TYPES.includes(file.type)) {
      setFormError('Format d’image non accepté. Formats autorisés : JPEG, PNG et WebP.');
      return;
    }

    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      setFormError('La photo ne peut pas dépasser 2 Mo.');
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoPreview(URL.createObjectURL(file));

    if (!token) {
      setFormError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    setIsUploading(true);

    try {
      const { user: updatedUser } = await profileApi.uploadPhoto(token, file);
      applyUser(updatedUser);
      setPhotoPreview(null);
      setNotice('Photo de profil mise à jour.');
    } catch (error) {
      setPhotoPreview(null);
      setFormError(error instanceof Error ? error.message : 'Envoi de la photo impossible.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (): Promise<void> => {
    setFormError(null);
    setNotice(null);

    if (!token) {
      setFormError('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    setIsUploading(true);

    try {
      const { user: updatedUser } = await profileApi.deletePhoto(token);
      applyUser(updatedUser);
      setPhotoPreview(null);
      setNotice('Photo de profil supprimée.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Suppression de la photo impossible.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-shell page">
      <AppHeader />

      <main className="page__main">
        <h1 className="page__title">Mon profil</h1>
        <p className="page__subtitle">
          Ces informations sont visibles par les personnes que vous rencontrez. Votre email reste
          toujours confidentiel.
        </p>

        {formError ? <Alert variant="error">{formError}</Alert> : null}
        {notice ? <Alert variant="notice">{notice}</Alert> : null}

        <section className="card" aria-labelledby="photo-section-title">
          <h2 id="photo-section-title" className="card__title">
            Photo de profil
          </h2>

          <div className="photo-row">
            {photoUrl ? (
              <img className="avatar avatar--lg" src={photoUrl} alt="Aperçu de votre photo" />
            ) : (
              <span className="avatar avatar--lg avatar--placeholder" aria-hidden="true">
                {(displayNameValue || user?.pseudonym || '?').slice(0, 1).toUpperCase()}
              </span>
            )}

            <div className="photo-row__actions">
              <input
                ref={fileInputRef}
                id="photo-input"
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                disabled={isUploading}
              />
              <label className="button button--secondary" htmlFor="photo-input">
                {isUploading ? 'Envoi…' : 'Choisir une photo'}
              </label>

              {user?.photoUrl ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={handleDeletePhoto}
                  disabled={isUploading}
                >
                  Supprimer
                </button>
              ) : null}

              <p className="form-field__hint">JPEG, PNG ou WebP, 2 Mo maximum.</p>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="identity-section-title">
          <h2 id="identity-section-title" className="card__title">
            Informations
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <FormField
              label="Nom affiché"
              value={displayName}
              onChange={setDisplayName}
              error={fieldErrors.displayName}
              hint="Laissez vide pour rester anonyme (pseudonyme uniquement)."
              placeholder="Miora"
              disabled={isSaving}
              required={false}
            />

            <FormField
              label="Centres d’intérêt"
              value={interests}
              onChange={setInterests}
              error={fieldErrors.interests}
              hint="Séparez-les par des virgules (10 maximum)."
              placeholder="musique, voyage, cuisine"
              disabled={isSaving}
              required={false}
            />

            <FormField
              label="Localisation"
              value={location}
              onChange={setLocation}
              error={fieldErrors.location}
              hint="Ville ou région, par exemple Antananarivo."
              placeholder="Antananarivo"
              disabled={isSaving}
              required={false}
            />

            <button type="submit" className="button" disabled={isSaving}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};
