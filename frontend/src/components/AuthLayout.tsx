import type { ReactNode } from 'react';

export interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Gabarit commun des écrans d'authentification.
 */
export const AuthLayout = ({ title, subtitle, children, footer }: AuthLayoutProps) => (
  <main className="app-shell auth-layout">
    <section className="auth-brand">
      <div className="auth-brand__logo" aria-hidden="true">
        💬 I-Keketa
      </div>
      <p className="auth-brand__tagline">
        Rencontrez d’autres utilisateurs de Madagascar et échangez de manière anonyme et sécurisée.
      </p>
    </section>

    <section className="auth-card">
      <h1 className="auth-card__title">{title}</h1>
      <p className="auth-card__subtitle">{subtitle}</p>
      {children}
      <p className="auth-card__footer">{footer}</p>
    </section>
  </main>
);
