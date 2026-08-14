import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); setTimeout(() => setShow(false), 3000); };
    const handleOffline = () => { setIsOnline(false); setShow(true); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setShow(true);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!show) return null;

  return (
    <div dir="rtl" className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
      <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm border ${isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
        {isOnline
          ? <><RefreshCw size={16} className="animate-spin" /><span>تم استعادة الاتصال ✓</span></>
          : <><WifiOff size={16} /><span>لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل</span></>
        }
      </div>
    </div>
  );
};
