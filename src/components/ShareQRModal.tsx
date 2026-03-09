import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ShareQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShareQRModal: React.FC<ShareQRModalProps> = ({ open, onOpenChange }) => {
  const [copied, setCopied] = useState(false);
  const appUrl = 'https://new-app-gold-one.vercel.app';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para HTTP (no HTTPS)
      const textArea = document.createElement('textarea');
      textArea.value = appUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-slate-800 dark:text-white">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
              <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Compartir Acceso
          </DialogTitle>
        </DialogHeader>

        {/* QR Code */}
        <div className="flex flex-col items-center px-6 pb-2">
          <div className="p-5 bg-white rounded-2xl border-2 border-slate-100 dark:border-slate-700 shadow-inner">
            <QRCodeSVG
              value={appUrl}
              size={220}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#1e293b"
            />
          </div>

          {/* Instrucciones */}
          <div className="flex items-center gap-2 mt-4 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
            <Smartphone className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Escaneá este código para acceder a la app
            </p>
          </div>
        </div>

        {/* URL + Copiar */}
        <div className="px-6 pb-6 pt-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
            Dirección de acceso
          </label>
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-700 dark:text-slate-300 truncate select-all mb-3">
            {appUrl}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 rounded-xl h-10 transition-all duration-300 ${
              copied
                ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                <span className="text-sm font-semibold">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="text-sm font-semibold">Copiar URL</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
