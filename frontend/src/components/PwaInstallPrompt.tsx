import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Bannière proposant l'installation de l'application (PWA).
 * N'apparaît que si le navigateur expose l'événement beforeinstallprompt.
 */
export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!visible || !deferredPrompt) {
    return null;
  }

  const handleInstall = async (): Promise<void> => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    } else {
      setVisible(false);
    }
  };

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Installer l'application">
      <p className="pwa-install-banner__text">
        Installez I-Keketa sur votre appareil pour un accès rapide.
      </p>
      <div className="pwa-install-banner__actions">
        <button type="button" className="button" onClick={() => void handleInstall()}>
          Installer
        </button>
        <button type="button" className="button button--ghost" onClick={() => setVisible(false)}>
          Plus tard
        </button>
      </div>
    </div>
  );
};
