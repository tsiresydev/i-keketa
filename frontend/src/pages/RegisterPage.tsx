import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { isAuthError, useAuth } from '../hooks/use-auth';
import { validateEmail, validatePassword, validatePasswordConfirmation } from '../lib/validation';

export const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
      passwordConfirmation: validatePasswordConfirmation(password, passwordConfirmation),
    };

    setFieldErrors(errors);

    if (errors.email || errors.password || errors.passwordConfirmation) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register(email, password);
      navigate('/chat', { replace: true });
    } catch (error) {
      setFormError(
        isAuthError(error) ? error.message : 'Inscription impossible. Veuillez réessayer.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Votre email reste confidentiel : votre partenaire ne le verra jamais."
      footer={
        <>
          Vous avez déjà un compte ? <Link to="/connexion">Se connecter</Link>
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
          hint="8 caractères minimum, avec majuscule, minuscule et chiffre."
          autoComplete="new-password"
          placeholder="••••••••"
          disabled={isSubmitting}
        />

        <FormField
          label="Confirmation du mot de passe"
          type="password"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
          error={fieldErrors.passwordConfirmation}
          autoComplete="new-password"
          placeholder="••••••••"
          disabled={isSubmitting}
        />

        <button type="submit" className="button" disabled={isSubmitting}>
          {isSubmitting ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>
    </AuthLayout>
  );
};
