import { VideoStream } from './VideoStream';
import type { MediaCallStatus } from '../types';

export interface VideoCallPanelProps {
  status: MediaCallStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  partnerMedia: { audio: boolean; video: boolean };
  partnerName: string;
  localDisplayName?: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
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
  partnerMedia,
  partnerName,
  localDisplayName = 'Vous',
  onAccept,
  onDecline,
  onEnd,
  onToggleMicrophone,
  onToggleCamera,
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
        <div className="call-tile call-tile--remote">
          {remoteStream ? (
            <VideoStream
              stream={remoteStream}
              className="call-tile__video"
              label={`Vidéo de ${partnerName}`}
            />
          ) : (
            <div className="call-tile__placeholder">
              <span className="avatar avatar--lg avatar--placeholder" aria-hidden="true">
                {partnerName.slice(0, 1).toUpperCase()}
              </span>
              <p className="call-stage__label">{partnerName}</p>
            </div>
          )}
          <span className="call-tile__name">{partnerName}</span>
        </div>

        <div className="call-tile call-tile--local">
          <VideoStream
            stream={localStream}
            muted
            className="call-tile__video"
            label="Votre vidéo"
          />
          {!isCameraEnabled ? (
            <span className="call-tile__off" aria-hidden="true">
              Caméra off
            </span>
          ) : null}
          <span className="call-tile__name">{localDisplayName}</span>
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
          aria-label={isMicrophoneEnabled ? 'Couper le micro' : 'Activer le micro'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span className="call-control__label">{isMicrophoneEnabled ? 'Micro' : 'Micro coupé'}</span>
        </button>

        <button
          type="button"
          className={`call-control ${isCameraEnabled ? '' : 'call-control--off'}`}
          onClick={onToggleCamera}
          aria-pressed={isCameraEnabled}
          title={isCameraEnabled ? 'Désactiver la caméra' : 'Activer la caméra'}
          aria-label={isCameraEnabled ? 'Désactiver la caméra' : 'Activer la caméra'}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7 16 12 23 17V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span className="call-control__label">
            {isCameraEnabled ? 'Caméra' : 'Caméra coupée'}
          </span>
        </button>

        <button
          type="button"
          className="call-control call-control--hangup"
          onClick={onEnd}
          title="Raccrocher"
          aria-label="Raccrocher"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
          </svg>
          <span className="call-control__label">Raccrocher</span>
        </button>
      </div>
    </section>
  );
};
