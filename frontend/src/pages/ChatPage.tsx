import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { ChatComposer } from '../components/ChatComposer';
import { MessageBubble } from '../components/MessageBubble';
import { useAuth } from '../hooks/use-auth';
import { useChatSocket } from '../hooks/use-chat-socket';

export const ChatPage = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const messageListRef = useRef<HTMLUListElement>(null);

  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const searchKey = searchParams.toString();

  const {
    connectionStatus,
    chatStatus,
    matchId,
    partnerPseudonym,
    partnerDisplayName,
    partnerPhotoUrl,
    messages,
    error,
    notice,
    joinQueue,
    leaveQueue,
    skipPartner,
    startDirectChat,
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

  // Cible d'une discussion directe demandée depuis la page « Découvrir ».
  useEffect(() => {
    const target = new URLSearchParams(searchKey).get('user');

    if (target) {
      setPendingTarget(target);
    }
  }, [searchKey]);

  // La discussion directe est lancée dès que la connexion temps réel est prête.
  useEffect(() => {
    if (connectionStatus !== 'connected' || !pendingTarget) {
      return;
    }

    setPendingTarget(null);
    setSearchParams({}, { replace: true });
    startDirectChat(pendingTarget);
  }, [connectionStatus, pendingTarget, startDirectChat, setSearchParams]);

  const isMatched = chatStatus === 'matched' && matchId !== null;
  const partnerName = partnerDisplayName ?? partnerPseudonym ?? '';
  const partnerInitial = partnerName.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell chat-page">
      <AppHeader connectionStatus={connectionStatus} />

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
              {partnerPhotoUrl ? (
                <img
                  className="avatar avatar--md"
                  src={partnerPhotoUrl}
                  alt=""
                  aria-hidden="true"
                />
              ) : (
                <span className="avatar avatar--md avatar--placeholder" aria-hidden="true">
                  {partnerInitial}
                </span>
              )}
              <span className="partner-bar__label">Discussion avec</span>
              <span className="partner-bar__name">{partnerName}</span>
              {partnerDisplayName && partnerPseudonym ? (
                <span className="partner-bar__pseudonym">({partnerPseudonym})</span>
              ) : null}
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
