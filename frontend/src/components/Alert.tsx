import type { ReactNode } from 'react';

export interface AlertProps {
  variant: 'error' | 'notice';
  children: ReactNode;
  onClose?: () => void;
}

/**
 * Bandeau d'information (erreur ou message contextuel).
 */
export const Alert = ({ variant, children, onClose }: AlertProps) => (
  <div className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
    <span>{children}</span>
    {onClose ? (
      <button
        type="button"
        className="alert__close"
        onClick={onClose}
        aria-label="Fermer le message"
      >
        ×
      </button>
    ) : null}
  </div>
);
