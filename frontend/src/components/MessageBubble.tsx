import type { ChatMessage } from '../types';

export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

const formatTime = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Message affiché dans la conversation. Le contenu est rendu comme du texte
 * (React échappe le HTML) — aucune interpolation de HTML brut.
 */
export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => (
  <li className={`message ${isOwn ? 'message--own' : 'message--partner'}`}>
    <div className="message__bubble">
      {message.content}
      <span className="message__meta">{formatTime(message.createdAt)}</span>
    </div>
  </li>
);
