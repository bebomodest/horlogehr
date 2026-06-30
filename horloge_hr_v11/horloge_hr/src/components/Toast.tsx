import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const config = {
    success: {
      bg: 'bg-[#e6e1d6]',
      border: 'border-[#76151e]',
      icon: <CheckCircle2 size={22} className="text-[#76151e] shrink-0" />,
      text: 'text-[#3a2a1f]',
      bar: 'bg-[#76151e]',
    },
    error: {
      bg: 'bg-[#e6e1d6]',
      border: 'border-red-500',
      icon: <XCircle size={22} className="text-red-500 shrink-0" />,
      text: 'text-[#3a2a1f]',
      bar: 'bg-red-500',
    },
    info: {
      bg: 'bg-[#e6e1d6]',
      border: 'border-blue-500',
      icon: <Info size={22} className="text-blue-500 shrink-0" />,
      text: 'text-[#3a2a1f]',
      bar: 'bg-blue-500',
    },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3" dir="rtl">
        {toasts.map((toast) => {
          const c = config[toast.type];
          return (
            <div
              key={toast.id}
              className={`
                ${c.bg} ${c.border} ${c.text}
                border-2 rounded-2xl shadow-2xl
                flex items-center gap-3
                px-4 py-3 min-w-[260px] max-w-[340px]
                backdrop-blur-md
                animate-slide-in
                relative overflow-hidden
              `}
              style={{ animation: 'slideIn 0.3s ease-out' }}
            >
              {/* Colored left bar */}
              <div className={`absolute right-0 top-0 bottom-0 w-1 ${c.bar} rounded-r-2xl`} />

              {c.icon}
              <span className="font-bold text-sm flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg hover:bg-black/10 transition-colors"
              >
                <X size={14} className="text-[#7a6a5f]" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
