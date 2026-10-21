import { useState, type FormEvent } from 'react';
import { Alert } from './Alert';
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason } from '../types';

export interface ReportDialogProps {
  open: boolean;
  partnerName: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (reason: ReportReason, details: string) => void;
  onClose: () => void;
}

/**
 * Formulaire de signalement d'abus.
 *
 * La modération n'étant pas implémentée, le signalement est seulement
 * transmis à la plateforme : aucun traitement n'est effectué côté client.
 */
export const ReportDialog = ({
  open,
  partnerName,
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: ReportDialogProps) => {
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSubmit(reason, details.trim());
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="report-dialog-title" className="modal__title">
          Signaler {partnerName}
        </h2>

        <p className="modal__text">
          Votre signalement est transmis de façon confidentielle. L’autre personne ne sera pas
          informée.
        </p>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="report-reason">
              Motif du signalement
            </label>
            <select
              id="report-reason"
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              disabled={isSubmitting}
            >
              {REPORT_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REPORT_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="report-details">
              Description (facultatif)
            </label>
            <textarea
              id="report-details"
              className="input"
              rows={4}
              maxLength={1000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Décrivez brièvement ce qui s’est passé."
              disabled={isSubmitting}
            />
            <span className="form-field__hint">1000 caractères maximum.</span>
          </div>

          <div className="modal__actions">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
