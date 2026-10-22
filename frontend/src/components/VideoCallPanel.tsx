import { VideoStream } from './VideoStream';
import type { MediaCallStatus } from '../types';

export interface VideoCallPanelProps {
  status: MediaCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  facingMode?: 'user' | 'environment';
  partnerMedia: { audio: boolean; video: boolean };
  partnerName: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMicrophone: () => void;
  onCycleCamera: () => void;
}

/**
 * Panneau d'appel audiovisuel : écran du partenaire, aperçu local et
 * commandes (micro, caméra, raccrocher).
 */
export const VideoCallPanel = ({
  status,
  localStream,
  remoteStream,
  isMicrophoneEnabled,
  isCameraEnabled,
  facingMode = 'user',
  partnerMedia,
  partnerName,
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onCycleCamera,
}: VideoCallPanelProps) => {
  if (status === 'idle') {
    return null;
  }

  if (status === 'ringing') {
    return (
      <section
        className="call-panel call-panel--incoming"
        role="alertdialog"
        aria-label="Appel entrant"
      >
        <p className="call-panel__title">📹 Appel entrant</p>
        <p className="call-panel__text">{partnerName} vous appelle.</p>
        <div className="call-panel__actions">
          <button type="button" className="button" onClick={onAccept}>
            Accepter
          </button>
          <button type="button" className="button button--secondary" onClick={onDecline}>
            Refuser
          </button>
        </div>
      </section>
    );
  }

  if (status === 'requesting') {
    return (
      <section className="call-panel" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p className="call-panel__title">Appel en cours…</p>
        <p className="call-panel__text">En attente de la réponse de {partnerName}.</p>
        <div className="call-panel__actions">
          <button type="button" className="button button--secondary" onClick={onEnd}>
            Annuler le match
          </button>
        </div>
      </section>
    );
  }

  if (status === 'connecting') {
    return (
      <section className="call-panel" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <p className="call-panel__title">Connexion à l’appel…</p>
      </section>
    );
  }

  return (
    <section className="call-panel call-panel--live" aria-label="Appel en cours">
      <div className="call-stage">
        {remoteStream ? (
          <VideoStream
            stream={remoteStream}
            className="call-stage__remote"
            label={`Vidéo de ${partnerName}`}
          />
        ) : (
          <div className="call-stage__placeholder">
            <span className="avatar avatar--lg avatar--placeholder" aria-hidden="true">
              {partnerName.slice(0, 1).toUpperCase()}
            </span>
            <p className="call-stage__label">{partnerName}</p>
          </div>
        )}

        <div className="call-stage__local">
          <VideoStream
            stream={localStream}
            muted
            className="call-stage__local-video"
            label="Votre vidéo"
          />
          {!isCameraEnabled ? (
            <span className="call-stage__local-off" aria-hidden="true">
              Caméra off
            </span>
          ) : null}
        </div>
      </div>

      {!partnerMedia.audio ? (
        <p className="call-panel__hint">Le micro de votre partenaire est coupé.</p>
      ) : null}

      <div className="call-controls">
        <button
          type="button"
          className={`call-control ${isMicrophoneEnabled ? '' : 'call-control--off'}`}
          onClick={onToggleMicrophone}
          aria-pressed={isMicrophoneEnabled}
          title={isMicrophoneEnabled ? 'Couper le micro' : 'Activer le micro'}
        >
          {isMicrophoneEnabled ? '🎙 Micro' : '🔇 Micro coupé'}
        </button>

        <button
          type="button"
          className={`call-control ${isCameraEnabled ? '' : 'call-control--off'}`}
          onClick={() => void onCycleCamera()}
          aria-pressed={isCameraEnabled}
          title={
            isCameraEnabled
              ? facingMode === 'user'
                ? 'Passer à la caméra dorsale'
                : 'Désactiver la caméra'
              : 'Activer la caméra'
          }
        >
          {isCameraEnabled
            ? facingMode === 'user'
              ? '📹 Caméra (frontale)'
              : '📹 Caméra (dorsale)'
            : '🚫 Caméra coupée'}
        </button>

        <button
          type="button"
          className="call-control call-control--hangup"
          onClick={onEnd}
          title="Raccrocher"
        >
          Raccrocher
        </button>
      </div>
    </section>
  );
};
