import React, { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Upload, FileText, Pencil, Save, Trash2, LogIn, LogOut, Settings, UserPlus, Filter, Loader2, X } from 'lucide-react';
import { Footer } from './Footer';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export interface ActivityLog {
  id: string;
  action: string;
  description: string;
  user: string;
  timestamp: any;
  type: 'fingerprint' | 'report' | 'edit' | 'delete' | 'login' | 'settings' | 'employee' | 'deduction' | 'payroll';
}

// Singleton logger - call this from anywhere in the app
export const logActivity = async (
  dbInstance: any,
  action: string,
  description: string,
  user: string,
  type: ActivityLog['type']
) => {
  try {
    const { db: defaultDb } = await import('../firebase');
    const dbToLog = defaultDb;
    await addDoc(collection(dbToLog, 'activity_logs'), {
      action, description, user, type,
      timestamp: serverTimestamp(),
    });
  } catch (e) { console.error('Failed to log activity:', e); }
};

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  fingerprint: { icon: <Upload size={16} />, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
  report:      { icon: <FileText size={16} />, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
  edit:        { icon: <Pencil size={16} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
  delete:      { icon: <Trash2 size={16} />, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
  login:       { icon: <LogIn size={16} />, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  settings:    { icon: <Settings size={16} />, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-100' },
  employee:    { icon: <UserPlus size={16} />, color: 'text-[#76151e]', bg: 'bg-[#76151e]/5 border-[#76151e]/10' },
  deduction:   { icon: <X size={16} />, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
  payroll:     { icon: <Save size={16} />, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-100' },
};

export default function NotificationsPage({ onBack }: { onBack: () => void }) {
  const dbToUse = db;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    const q = query(collection(dbToUse, 'activity_logs'), orderBy('timestamp', 'desc'), limit(200));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [dbToUse]);

  const users = [...new Set(logs.map(l => l.user))].filter(Boolean);

  const filtered = logs.filter(l => {
    if (filterType !== 'all' && l.type !== filterType) return false;
    if (filterUser && l.user !== filterUser) return false;
    return true;
  });

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return '';
    try {
      return format(ts.toDate(), 'dd MMM yyyy - hh:mm a', { locale: ar });
    } catch { return ''; }
  };

  const typeLabels: Record<string, string> = {
    all: 'الكل', fingerprint: 'بصمة', report: 'تقارير',
    edit: 'تعديل', delete: 'حذف', login: 'دخول/خروج',
    settings: 'إعدادات', employee: 'موظفين', deduction: 'خصومات', payroll: 'رواتب'
  };

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f] flex items-center gap-2">
          <Bell size={24} className="text-[#76151e]" />
          الإشعارات والنشاط
        </h1>
        <div className="bg-[#76151e] text-white px-3 py-1 rounded-full text-sm font-bold">{filtered.length}</div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 z-10 relative pb-12">
        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-4 mb-5 border border-white/60 shadow-md">
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(typeLabels).map(([k, v]) => (
              <button key={k} onClick={() => setFilterType(k)}
                className={`px-3 py-1.5 rounded-full font-bold text-xs transition-all ${filterType === k ? 'bg-[#76151e] text-white shadow-md' : 'bg-white/60 text-[#5a4a3f] hover:bg-white/80'}`}>
                {v}
              </button>
            ))}
          </div>
          {users.length > 0 && (
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-2 text-sm font-bold text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#76151e]">
              <option value="">كل المستخدمين</option>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#76151e]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#7a6a5f] font-bold text-xl">لا توجد سجلات نشاط</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(log => {
              const cfg = typeConfig[log.type] || typeConfig.edit;
              return (
                <div key={log.id} className={`${cfg.bg} border rounded-2xl p-4 flex items-start gap-4 shadow-sm`}>
                  <div className={`w-9 h-9 rounded-full ${cfg.bg} border flex items-center justify-center shrink-0 ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className={`font-bold text-sm ${cfg.color}`}>{log.action}</p>
                      <span className="text-xs text-[#9a8a7f] shrink-0">{formatTime(log.timestamp)}</span>
                    </div>
                    <p className="text-[#5a4a3f] text-sm mt-0.5">{log.description}</p>
                    <p className="text-xs text-[#7a6a5f] mt-1 font-bold">👤 {log.user}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
