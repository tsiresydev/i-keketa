import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { ChatComposer } from '../components/ChatComposer';
import { MessageBubble } from '../components/MessageBubble';
import { useAuth } from '../hooks/use-auth';
import { useChatSocket } from '../hooks/use-chat-socket';

export const ChatPage = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const messageListRef = useRef<HTMLUListElement>(null);

  const {
    connectionStatus,
    chatStatus,
    matchId,
    partnerPseudonym,
    messages,
    error,
    notice,
    joinQueue,
    leaveQueue,
    skipPartner,
    sendMessage,
    clearError,
    clearNotice,
  } = useChatSocket(token);

  // Défile automatiquement vers le dernier message reçu.
  useEffect(() => {
    const list = messageListRef.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const handleLogout = (): void => {
    leaveQueue();
    logout();
    navigate('/connexion', { replace: true });
  };

  const isMatched = chatStatus === 'matched' && matchId !== null;

  return (
    <div className="app-shell chat-page">
      <header className="chat-header">
        <span className="chat-header__brand">💬 I-Keketa</span>
        <span className="chat-header__user">
          <strong>{user?.pseudonym ?? 'Invité'}</strong>
          <span>
            <span
              className={`status-dot ${connectionStatus === 'connected' ? 'status-dot--online' : ''}`}
              aria-hidden="true"
            />
            {connectionStatus === 'connected' ? 'En ligne' : 'Hors ligne'}
          </span>
        </span>
        <button type="button" className="button button--ghost" onClick={handleLogout}>
          Déconnexion
        </button>
      </header>

      <main className="chat-main">
        {error ? (
          <Alert variant="error" onClose={clearError}>
            {error}
          </Alert>
        ) : null}

        {notice ? (
          <Alert variant="notice" onClose={clearNotice}>
            {notice}
          </Alert>
        ) : null}

        {isMatched ? (
          <>
            <div className="partner-bar">
              <span className="partner-bar__label">Discussion avec</span>
              <span className="partner-bar__name">{partnerPseudonym}</span>
            </div>

            <ul
              className="message-list"
              ref={messageListRef}
              role="log"
              aria-live="polite"
              aria-label="Messages"
            >
              {messages.length === 0 ? (
                <li className="message-list__empty">Démarrez la conversation par un bonjour 👋</li>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={message.senderId === user?.id}
                  />
                ))
              )}
            </ul>

            <ChatComposer disabled={!isMatched} onSend={sendMessage} />
          </>
        ) : chatStatus === 'waiting' ? (
          <section className="chat-panel" aria-live="polite">
            <div className="spinner" aria-hidden="true" />
            <h2 className="chat-panel__title">Recherche d’un partenaire…</h2>
            <p className="chat-panel__text">
              Vous serez mis en relation avec une autre personne de la plateforme dès que possible.
            </p>
            <div className="chat-panel__actions">
              <button type="button" className="button button--secondary" onClick={leaveQueue}>
                Arrêter la recherche
              </button>
            </div>
          </section>
        ) : (
          <section className="chat-panel">
            <h2 className="chat-panel__title">Prêt à discuter ?</h2>
            <p className="chat-panel__text">
              Rejoignez la file d’attente pour être mis en relation aléatoirement avec un autre
              utilisateur. Votre identité reste anonyme.
            </p>
            <div className="chat-panel__actions">
              <button
                type="button"
                className="button"
                onClick={joinQueue}
                disabled={connectionStatus !== 'connected'}
              >
                {connectionStatus === 'connected' ? 'Trouver quelqu’un' : 'Connexion en cours…'}
              </button>
            </div>
          </section>
        )}
      </main>

      {isMatched ? (
        <footer className="chat-footer">
          <button type="button" className="button button--ghost" onClick={skipPartner}>
            Passer à quelqu’un d’autre
          </button>
        </footer>
      ) : null}
    </div>
  );
};
