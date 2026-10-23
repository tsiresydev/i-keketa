import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { ChatComposer } from '../components/ChatComposer';
import { MessageBubble } from '../components/MessageBubble';
import { VideoCallPanel } from '../components/VideoCallPanel';
import { VideoStream } from '../components/VideoStream';
import { useSession } from '../hooks/use-session';
import { useChatSocket } from '../hooks/use-chat-socket';
import { useMediaCall } from '../hooks/use-media-call';

export const ChatPage = () => {
  const { user, token } = useSession();
  const location = useLocation();
  const messageListRef = useRef<HTMLUListElement>(null);
  const modalListRef = useRef<HTMLUListElement>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const {
    connectionStatus,
    chatStatus,
    matchId,
    partnerDisplayName,
    messages,
    error,
    notice,
    socket,
    joinQueue,
    leaveQueue,
    skipPartner,
    sendMessage,
    clearError,
    clearNotice,
  } = useChatSocket(token);

  const {
    status: callStatus,
    localStream,
    remoteStream,
    isMicrophoneEnabled,
    isCameraEnabled,
    partnerMedia,
    error: callError,
    notice: callNotice,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    clearError: clearCallError,
    clearNotice: clearCallNotice,
  } = useMediaCall(socket, matchId);

  /** Session de chat pour laquelle l'appel vidéo a déjà été lancé. */
  const autoCallMatchRef = useRef<string | null>(null);
  /** Session de chat pour laquelle l'appel entrant a déjà été accepté. */
  const autoAcceptMatchRef = useRef<string | null>(null);

  // L'appel vidéo se lance automatiquement dès qu'un partenaire est trouvé.
  useEffect(() => {
    if (!matchId || autoCallMatchRef.current === matchId) {
      return;
    }

    if (connectionStatus !== 'connected') {
      return;
    }

    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
      setPreviewStream(null);
    }

    autoCallMatchRef.current = matchId;

    void startCall({ automatic: true });
  }, [matchId, connectionStatus, startCall]);

  // Réinitialise l'appel dès que la session de chat n'est plus active.
  useEffect(() => {
    if (chatStatus !== 'matched' && callStatus !== 'idle') {
      endCall();
    }
  }, [chatStatus, callStatus, endCall]);
  useEffect(() => {
    if (callStatus !== 'ringing') {
      autoAcceptMatchRef.current = null;
      return;
    }

    if (!matchId || autoAcceptMatchRef.current === matchId) {
      return;
    }

    autoAcceptMatchRef.current = matchId;

    void acceptCall({ automatic: true });
  }, [callStatus, matchId, acceptCall]);

  // Défile automatiquement vers le dernier message reçu.
  useEffect(() => {
    const list = messageListRef.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const autoSearch = (location.state as { autoSearch?: boolean } | null)?.autoSearch === true;
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(autoSearch);

  const handleLeaveQueue = useCallback(() => {
    setAutoJoinEnabled(false);
    leaveQueue();
  }, [leaveQueue]);

  useEffect(() => {
    if (!autoJoinEnabled) {
      return;
    }

    if (chatStatus !== 'idle' || connectionStatus !== 'connected') {
      return;
    }

    joinQueue();
  }, [autoJoinEnabled, chatStatus, connectionStatus, joinQueue]);

  // Acquisition de la caméra pendant la recherche pour afficher un aperçu local.
  useEffect(() => {
    if (chatStatus !== 'waiting') {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
        setPreviewStream(null);
      }
      return;
    }

    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        previewStreamRef.current = stream;
        setPreviewStream(stream);
      } catch {
        // Permission refusée : on garde l'affichage sans aperçu.
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
        setPreviewStream(null);
      }
    };
  }, [chatStatus]);

  // Défile automatiquement vers le dernier message reçu (fenêtre modale).
  useEffect(() => {
    const list = modalListRef.current;

    if (list && isChatOpen) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, isChatOpen]);

  const isMatched = chatStatus === 'matched' && matchId !== null;
  const partnerName = partnerDisplayName ?? '';
  const partnerInitial = partnerName.slice(0, 1).toUpperCase();
  const isCallActive = callStatus !== 'idle';
  const isInCall = callStatus === 'in-call';

  return (
    <div className="app-shell chat-page">
      <AppHeader
        connectionStatus={connectionStatus}
      />

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

        {callError ? (
          <Alert variant="error" onClose={clearCallError}>
            {callError}
          </Alert>
        ) : null}

        {callNotice ? (
          <Alert variant="notice" onClose={clearCallNotice}>
            {callNotice}
          </Alert>
        ) : null}

        {isInCall ? (
          <>
            <button
              type="button"
              className="chat-bubble"
              onClick={() => setIsChatOpen(true)}
              aria-label="Ouvrir la discussion"
              title="Discussion"
            >
              💬
              {messages.length > 0 ? (
                <span className="chat-bubble__badge">{messages.length}</span>
              ) : null}
            </button>

            {isChatOpen ? (
              <div className="modal-backdrop" onClick={() => setIsChatOpen(false)}>
                <div
                  className="modal chat-modal"
                  role="dialog"
                  aria-label="Discussion"
                  onClick={(event) => event.stopPropagation()}
                >
                  <h2 className="modal__title">Discussion</h2>
                  <ul
                    className="message-list chat-modal__list"
                    ref={modalListRef}
                    role="log"
                    aria-live="polite"
                    aria-label="Messages"
                  >
                    {messages.length === 0 ? (
                      <li className="message-list__empty">
                        Démarrez la conversation par un bonjour 👋
                      </li>
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
                  <div className="modal__actions">
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setIsChatOpen(false)}
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {isMatched ? (
          <>
            <div className="partner-bar">
              <span className="avatar avatar--md avatar--placeholder" aria-hidden="true">
                {partnerInitial}
              </span>
              <span className="partner-bar__label">Discussion avec</span>
              <span className="partner-bar__name">{partnerName}</span>

              <span className="partner-bar__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void startCall()}
                  disabled={isCallActive || connectionStatus !== 'connected'}
                >
                  📹 Lancer l’appel vidéo
                </button>
              </span>
            </div>

            <VideoCallPanel
              status={callStatus}
              localStream={localStream}
              remoteStream={remoteStream}
               isMicrophoneEnabled={isMicrophoneEnabled}
               isCameraEnabled={isCameraEnabled}
               partnerMedia={partnerMedia}
               partnerName={partnerName}
               localDisplayName={user?.displayName ?? 'Vous'}
              onAccept={() => void acceptCall()}
              onDecline={declineCall}
              onEnd={endCall}
               onToggleMicrophone={toggleMicrophone}
               onToggleCamera={toggleCamera}
            />

            {!isInCall ? (
              <>
                <ul
                  className="message-list"
                  ref={messageListRef}
                  role="log"
                  aria-live="polite"
                  aria-label="Messages"
                >
                  {messages.length === 0 ? (
                    <li className="message-list__empty">
                      Démarrez la conversation par un bonjour 👋
                    </li>
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
            ) : null}
          </>
        ) : chatStatus === 'waiting' ? (
          <section className="chat-panel chat-panel--waiting" aria-live="polite">
            {previewStream ? (
              <VideoStream stream={previewStream} className="waiting-preview__video" muted label="Votre caméra" />
            ) : (
              <div className="spinner" aria-hidden="true" />
            )}
            <h2 className="chat-panel__title">Recherche d’un partenaire…</h2>
            <p className="chat-panel__text">
              Vous serez mis en relation avec un autre utilisateur de la plateforme dès qu’un
              partenaire sera disponible.
            </p>
            <div className="chat-panel__actions">
               <button type="button" className="button button--secondary" onClick={handleLeaveQueue}>
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
                {connectionStatus === 'connected' ? 'Trouver un partenaire' : 'Connexion en cours…'}
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

      {isMatched && !isCallActive ? (
        <button
          type="button"
          className="call-launch-fab"
          onClick={() => void startCall()}
          aria-label="Lancer l’appel vidéo"
          title="Lancer l’appel vidéo"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7 16 12 23 17V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </button>
      ) : null}
    </div>
  );
};
