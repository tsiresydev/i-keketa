import { useEffect, useRef, useState } from 'react';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { ChatComposer } from '../components/ChatComposer';
import { MessageBubble } from '../components/MessageBubble';
import { ReportDialog } from '../components/ReportDialog';
import { VideoCallPanel } from '../components/VideoCallPanel';
import { useSession } from '../hooks/use-session';
import { useChatSocket } from '../hooks/use-chat-socket';
import { useMediaCall } from '../hooks/use-media-call';
import { reportsApi } from '../lib/api-client';
import type { ReportReason } from '../types';

export const ChatPage = () => {
  const { user, token } = useSession();
  const messageListRef = useRef<HTMLUListElement>(null);

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

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

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

    autoCallMatchRef.current = matchId;

    void startCall({ automatic: true });
  }, [matchId, connectionStatus, startCall]);

  // L'appel entrant est accepté automatiquement : la conversation vidéo
  // démarre sans action supplémentaire de l'utilisateur.
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

  const handleReport = async (reason: ReportReason, details: string): Promise<void> => {
    if (!token || !matchId) {
      return;
    }

    setIsReporting(true);
    setReportError(null);

    try {
      await reportsApi.create(token, {
        matchId,
        reason,
        ...(details ? { details } : {}),
      });

      setIsReportOpen(false);
      setReportSuccess('Signalement envoyé. Merci de nous avoir alertés.');
    } catch (submitError) {
      setReportError(
        submitError instanceof Error
          ? submitError.message
          : 'Le signalement n’a pas pu être envoyé.',
      );
    } finally {
      setIsReporting(false);
    }
  };

  const isMatched = chatStatus === 'matched' && matchId !== null;
  const partnerName = partnerDisplayName ?? '';
  const partnerInitial = partnerName.slice(0, 1).toUpperCase();
  const isCallActive = callStatus !== 'idle';

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

        {reportSuccess ? (
          <Alert variant="notice" onClose={() => setReportSuccess(null)}>
            {reportSuccess}
          </Alert>
        ) : null}

        {isMatched ? (
          <>
            <div className="partner-bar">
              <span className="avatar avatar--md avatar--placeholder" aria-hidden="true">
                {partnerInitial}
              </span>
              <span className="partner-bar__label">Match avec</span>
              <span className="partner-bar__name">{partnerName}</span>

              <span className="partner-bar__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void startCall()}
                  disabled={isCallActive || connectionStatus !== 'connected'}
                >
                  📹 Lancer le match
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    setReportError(null);
                    setIsReportOpen(true);
                  }}
                >
                  🚩 Signaler
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
              onAccept={() => void acceptCall()}
              onDecline={declineCall}
              onEnd={endCall}
              onToggleMicrophone={toggleMicrophone}
              onToggleCamera={toggleCamera}
            />

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
            <h2 className="chat-panel__title">Recherche d’un adversaire…</h2>
            <p className="chat-panel__text">
              Vous serez mis en relation avec un autre visiteur dès qu’un adversaire sera
              disponible.
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
              Rejoignez la file d’attente pour être mis en relation avec un adversaire. Votre
              identité reste anonyme.
            </p>
            <div className="chat-panel__actions">
              <button
                type="button"
                className="button"
                onClick={joinQueue}
                disabled={connectionStatus !== 'connected'}
              >
                {connectionStatus === 'connected' ? 'Trouver un adversaire' : 'Connexion en cours…'}
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

      <ReportDialog
        open={isReportOpen}
        partnerName={partnerName}
        isSubmitting={isReporting}
        error={reportError}
        onSubmit={(reason, details) => void handleReport(reason, details)}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
};
