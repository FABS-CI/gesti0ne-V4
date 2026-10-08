import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Share, PlusSquare, Monitor, Smartphone, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'other'>('other');

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      console.debug('App is already in standalone mode');
      return;
    }

    // Check last dismissal (removed for testing Android installability)
    /*
    const lastPrompt = localStorage.getItem('pwa-prompt-last-dismissed');
    if (lastPrompt) {
      const lastPromptDate = new Date(lastPrompt);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - lastPromptDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 1) return; 
    }
    */

    // Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
      // Show iOS prompt after a short delay
      const timer = setTimeout(() => {
        console.debug('Triggering iOS install prompt');
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (/android/.test(ua) || /chrome|chromium|crios/i.test(ua)) {
      setPlatform('android'); // Chrome on desktop behaves like Android for beforeinstallprompt
    } else {
      setPlatform('desktop');
    }

    const handler = (e: Event) => {
      console.debug('beforeinstallprompt event captured');
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-last-dismissed', new Date().toISOString());
  };

  if (!showPrompt) {
    // Hidden button to force show for testing if needed
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md border-warning/20">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <img src="/fabs-logo.png" alt="GESTI-ONE" className="h-16 w-auto" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center text-warning">
            Installer GESTI-ONE
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Installez GESTI-ONE sur votre appareil pour un accès plus rapide et une expérience optimale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="bg-warning/10 p-2 rounded-full">
                <Monitor className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium text-sm">Accès direct</p>
                <p className="text-xs text-muted-foreground">Un clic depuis l'écran d'accueil ou le Bureau.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="bg-warning/10 p-2 rounded-full">
                <Smartphone className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium text-sm">Plein écran</p>
                <p className="text-xs text-muted-foreground">Ouverture sans barre de navigation navigateur.</p>
              </div>
            </div>
          </div>

          {platform === 'ios' && (
            <div className="mt-4 p-4 border border-warning/40 bg-warning/10 rounded-xl space-y-3">
              <p className="font-semibold text-warning text-sm flex items-center gap-2">
                <PlusSquare className="h-4 w-4" /> Instructions pour iPhone / iPad :
              </p>
              <ol className="text-sm text-warning space-y-2 list-decimal ml-4">
                <li>Appuyez sur le bouton <strong>Partager</strong> <Share className="inline h-4 w-4 mx-1" /> en bas de l'écran.</li>
                <li>Faites défiler et choisissez <strong>"Sur l'écran d'accueil"</strong>.</li>
                <li>Appuyez sur <strong>Ajouter</strong> en haut à droite.</li>
              </ol>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {platform !== 'ios' ? (
            <Button 
              onClick={handleInstall} 
              className="w-full bg-warning hover:bg-warning text-white font-bold"
            >
              <Download className="mr-2 h-4 w-4" /> Installer maintenant
            </Button>
          ) : (
            <Button 
              onClick={handleDismiss} 
              className="w-full bg-warning hover:bg-warning text-white font-bold"
            >
              J'ai compris
            </Button>
          )}
          <Button variant="ghost" onClick={handleDismiss} className="w-full sm:w-auto">
            Plus tard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
