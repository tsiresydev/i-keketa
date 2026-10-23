import { useRef, useState, type FormEvent } from 'react';
import { MESSAGE_MAX_LENGTH } from '../lib/validation';

export interface ChatComposerProps {
  disabled: boolean;
  onSend: (content: string) => boolean;
}

/**
 * Zone de saisie des messages (Envoi par le bouton ou la touche Entrée).
 */
export const ChatComposer = ({ disabled, onSend }: ChatComposerProps) => {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    const sent = onSend(content.trim());

    if (sent) {
      setContent('');
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit} aria-label="Envoyer un message">
      <input
        ref={inputRef}
        className="input composer__input"
        type="text"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Écrivez votre message…"
        maxLength={MESSAGE_MAX_LENGTH}
        disabled={disabled}
        aria-label="Votre message"
        autoComplete="off"
      />
      <button
        type="submit"
        className="button composer__button"
        disabled={disabled || content.trim() === ''}
      >
        Envoyer
      </button>
    </form>
  );
};
