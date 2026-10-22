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
  localDisplayName?: string;
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
  localDisplayName = 'Vous',
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
        >
          {isMicrophoneEnabled ? 'ðŸŽ™ Micro' : 'ðŸ”‡ Micro coupé'}
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
              ? 'ðŸ“¹ Caméra (frontale)'
              : 'ðŸ“¹ Caméra (dorsale)'
            : 'ðŸš« Caméra coupée'}
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
