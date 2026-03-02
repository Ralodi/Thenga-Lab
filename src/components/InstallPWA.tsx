
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export const InstallPWA: React.FC = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  const handleInstallClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
  };
  
  if (!supportsPWA) {
    return null;
  }
  
  return (
    <div className="my-4 p-3 bg-white rounded-lg shadow-sm border border-thenga-gold/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-thenga-brown">
            Install Thenga Lite on your device for easy access
          </p>
        </div>
        <Button 
          onClick={handleInstallClick}
          variant="outline"
          className="bg-thenga-light text-thenga-brown hover:bg-thenga-gold hover:text-white"
        >
          <Download className="mr-2 h-4 w-4" /> Install App
        </Button>
      </div>
    </div>
  );
};
