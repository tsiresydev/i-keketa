import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { AppHeader } from '../components/AppHeader';
import { ChatComposer } from '../components/ChatComposer';
import { MessageBubble } from '../components/MessageBubble';
import { ReportDialog } from '../components/ReportDialog';
import { VideoCallPanel } from '../components/VideoCallPanel';
import { useAuth } from '../hooks/use-auth';
import { useChatSocket } from '../hooks/use-chat-socket';
import { useMediaCall } from '../hooks/use-media-call';
import { reportsApi } from '../lib/api-client';
import type { ReportReason } from '../types';

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
    socket,
    joinQueue,
    leaveQueue,
    skipPartner,
    startDirectChat,
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
  const partnerName = partnerDisplayName ?? partnerPseudonym ?? '';
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

              <span className="partner-bar__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => void startCall()}
                  disabled={isCallActive || connectionStatus !== 'connected'}
                >
                  📹 Appeler
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
