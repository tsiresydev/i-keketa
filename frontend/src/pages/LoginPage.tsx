import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { isAuthError, useAuth } from '../hooks/use-auth';
import { validateEmail } from '../lib/validation';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/chat';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = password.length === 0 ? 'Le mot de passe est requis.' : undefined;

    setFieldErrors({ email: emailError, password: passwordError });

    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(
        isAuthError(error) ? error.message : 'Connexion impossible. Veuillez réessayer.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Retrouvez votre session pour continuer à discuter."
      footer={
        <>
          Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
        </>
      }
    >
      {formError ? <Alert variant="error">{formError}</Alert> : null}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Adresse email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
          placeholder="vous@exemple.mg"
          disabled={isSubmitting}
        />

        <FormField
          label="Mot de passe"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={isSubmitting}
        />

        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthLayout>
  );
};
