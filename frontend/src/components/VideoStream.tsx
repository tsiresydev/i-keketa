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

    if (stream) {
      void element.play().catch(() => undefined);
    }
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
