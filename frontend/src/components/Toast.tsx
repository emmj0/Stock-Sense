import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const iconStyles = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

export function Toast({ message, type = 'info', onClose, duration = 3500 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = icons[type];

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${styles[type]}`}>
        <Icon size={18} className={iconStyles[type]} />
        <p className="text-sm font-medium">{message}</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 200); }} className="p-0.5 rounded hover:bg-black/5 transition-colors ml-2">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* Confirm modal — replaces window.confirm */
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[100]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-sm mx-4 animate-scale-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${destructive ? 'bg-red-50' : 'bg-brand-50'}`}>
              <AlertTriangle size={20} className={destructive ? 'text-red-500' : 'text-brand-500'} />
            </div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
          <div className="flex gap-2 px-6 pb-5">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
                destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
