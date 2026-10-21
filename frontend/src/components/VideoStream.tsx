import { useEffect, useRef } from 'react';

export interface VideoStreamProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
  /** Libellé accessible du flux. */
  label: string;
}

/**
 * Élément vidéo branché sur un MediaStream.
 * Le flux local est toujours muet pour éviter un écho.
 */
export const VideoStream = ({ stream, muted = false, className, label }: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;

    if (!element) {
      return;
    }

    element.srcObject = stream;

    if (!stream) {
      return;
    }

    const play = (): void => {
      void element.play().catch(() => undefined);
    };

    play();

    // Certains navigateurs bloquent la lecture automatique d'une vidéo avec
    // le son : la lecture est relancée à la première interaction de
    // l'utilisateur (l'appel vidéo démarré automatiquement reste visible).
    const retry = (): void => {
      play();
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
    };

    document.addEventListener('pointerdown', retry);
    document.addEventListener('keydown', retry);

    return () => {
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('keydown', retry);
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
    />
  );
};
