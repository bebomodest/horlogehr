import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: string; message: string; type: ToastType; }
interface ToastContextType { addToast: (message: string, type?: ToastType) => void; }
const ToastContext = createContext<ToastContextType | undefined>(undefined);

const CONFIG = {
  success: { icon: <CheckCircle2 size={36} className="text-emerald-500"/>, title: 'تم بنجاح', titleColor: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50', btnBg: 'bg-emerald-600 hover:bg-emerald-700' },
  error:   { icon: <XCircle size={36} className="text-red-500"/>,          title: 'خطأ',      titleColor: 'text-red-700',     border: 'border-red-200',     bg: 'bg-red-50',     btnBg: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: <AlertTriangle size={36} className="text-amber-500"/>,  title: 'تنبيه',    titleColor: 'text-amber-700',   border: 'border-amber-200',   bg: 'bg-amber-50',   btnBg: 'bg-amber-600 hover:bg-amber-700' },
  info:    { icon: <Info size={36} className="text-blue-500"/>,             title: 'معلومة',   titleColor: 'text-blue-700',    border: 'border-blue-200',    bg: 'bg-blue-50',    btnBg: 'bg-blue-600 hover:bg-blue-700' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).slice(2,8);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  const current = toasts[0];
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {current && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => dismiss(current.id)}>
          <div dir="rtl"
            className={`relative w-full max-w-sm rounded-3xl shadow-2xl border-2 ${CONFIG[current.type].bg} ${CONFIG[current.type].border} flex flex-col items-center text-center px-6 py-7 gap-4`}
            style={{ animation: 'popupIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-2xl bg-white/70 flex items-center justify-center shadow-sm">{CONFIG[current.type].icon}</div>
            <p className={`text-lg font-black ${CONFIG[current.type].titleColor}`}>{CONFIG[current.type].title}</p>
            <p className="text-[#3a2a1f] font-bold text-sm leading-relaxed whitespace-pre-line">{current.message}</p>
            <button onClick={() => dismiss(current.id)}
              className={`mt-1 w-full py-3 rounded-2xl text-white font-black text-base transition-all ${CONFIG[current.type].btnBg}`}>
              موافق
            </button>
            {toasts.length > 1 && <p className="text-xs text-[#9a8a7f] font-bold">{toasts.length - 1} رسالة أخرى في الانتظار</p>}
          </div>
        </div>
      )}
      <style>{`@keyframes popupIn{from{opacity:0;transform:scale(0.75) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
