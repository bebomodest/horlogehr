import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Search, Link, Unlink, Calendar, Users, Eye, AlertCircle, CheckCircle2, Loader2, ServerCrash } from 'lucide-react';

// Middleware URL — يشتغل على نفس الجهاز
const MIDDLEWARE_URL = 'http://localhost:4370';

interface ZKRecord {
  name: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
}

interface ZKUser {
  uid: string;
  name: string;
}

interface Props {
  onDataLoaded: (rows: ZKRecord[]) => void;
}

type ConnectionStatus = 'idle' | 'scanning' | 'connected' | 'error';

export default function ZKConnectPanel({ onDataLoaded }: Props) {
  const [expanded,   setExpanded]   = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('idle');
  const [deviceIp,   setDeviceIp]   = useState('192.168.1.201');
  const [devicePort, setDevicePort] = useState('4370');
  const [errMsg,     setErrMsg]     = useState('');
  const [users,      setUsers]      = useState<ZKUser[]>([]);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [selUsers,   setSelUsers]   = useState<string[]>([]);
  const [selectAll,  setSelectAll]  = useState(true);
  const [pulling,    setPulling]    = useState(false);
  const [middlewareOk, setMiddlewareOk] = useState<boolean | null>(null);

  // التحقق من وجود الـ middleware عند الفتح
  useEffect(() => {
    if (!expanded) return;
    checkMiddleware();
  }, [expanded]);

  const checkMiddleware = async () => {
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/ping`, { signal: AbortSignal.timeout(2000) });
      setMiddlewareOk(res.ok);
    } catch {
      setMiddlewareOk(false);
    }
  };

  const connect = async () => {
    setConnStatus('scanning');
    setErrMsg('');
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: deviceIp, port: parseInt(devicePort) }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشل الاتصال');
      setConnStatus('connected');
      // جلب قائمة المستخدمين
      const uRes = await fetch(`${MIDDLEWARE_URL}/users`, { signal: AbortSignal.timeout(8000) });
      const uData = await uRes.json();
      setUsers(uData.users || []);
    } catch (e: any) {
      setConnStatus('error');
      setErrMsg(e.message || 'تعذّر الاتصال بالجهاز');
    }
  };

  const disconnect = () => {
    setConnStatus('idle');
    setUsers([]);
    setSelUsers([]);
    setErrMsg('');
  };

  const toggleUser = (uid: string) => {
    setSelectAll(false);
    setSelUsers(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  const pullData = async () => {
    if (!dateFrom || !dateTo) { setErrMsg('يرجى تحديد الفترة الزمنية'); return; }
    setPulling(true);
    setErrMsg('');
    try {
      const body: any = { dateFrom, dateTo };
      if (!selectAll && selUsers.length > 0) body.uids = selUsers;
      const res = await fetch(`${MIDDLEWARE_URL}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشل سحب البيانات');
      onDataLoaded(data.records as ZKRecord[]);
    } catch (e: any) {
      setErrMsg(e.message || 'فشل سحب بيانات البصمة');
    } finally {
      setPulling(false);
    }
  };

  return (
    <div dir="rtl" className="bg-[#fffdfa] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#e6dfd3] overflow-hidden">

      {/* Header — زر الاتصال */}
      <button
        onClick={() => setExpanded(p => !p)}
        className={`w-full flex items-center justify-between px-6 py-4 transition-all
          ${connStatus === 'connected' ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-white/60 border-b border-[#e6dfd3]'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm
            ${connStatus === 'connected' ? 'bg-emerald-100 text-emerald-600' : 'bg-[#76151e]/10 text-[#76151e]'}`}>
            {connStatus === 'scanning' ? <Loader2 size={20} className="animate-spin" /> :
             connStatus === 'connected' ? <Wifi size={20} /> :
             connStatus === 'error'     ? <WifiOff size={20} className="text-red-500" /> :
             <Wifi size={20} />}
          </div>
          <div className="text-right">
            <p className="font-black text-[#3a2a1f] text-base">اتصال بجهاز البصمة</p>
            <p className={`text-xs font-bold ${connStatus === 'connected' ? 'text-emerald-600' : 'text-[#a09080]'}`}>
              {connStatus === 'connected' ? `✅ متصل — ${deviceIp}` :
               connStatus === 'scanning'  ? 'جاري الاتصال...' :
               connStatus === 'error'     ? '❌ فشل الاتصال' :
               'اضغط للاتصال بجهاز البصمة عبر الشبكة (LAN)'}
            </p>
          </div>
        </div>
        <span className={`text-[#a09080] transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {/* Panel Body */}
      {expanded && (
        <div className="p-5 flex flex-col gap-4">

          {/* Middleware check */}
          {middlewareOk === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <ServerCrash size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-black text-amber-700 text-sm mb-1">برنامج الوسيط غير مشغَّل</p>
                <p className="text-xs text-amber-600 font-bold leading-relaxed">
                  لا يمكن الاتصال بجهاز البصمة مباشرةً من المتصفح — يجب تشغيل برنامج الوسيط (<code>horloge_bridge.py</code>) على نفس الكمبيوتر أولاً.
                </p>
                <button onClick={checkMiddleware} className="mt-2 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-amber-700 transition-all">
                  إعادة الفحص
                </button>
              </div>
            </div>
          )}

          {/* IP + Port */}
          {connStatus !== 'connected' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-black text-[#5a4a3f] mb-1">عنوان IP لجهاز البصمة</label>
                <input
                  type="text" value={deviceIp} onChange={e => setDeviceIp(e.target.value)}
                  placeholder="192.168.1.201"
                  className="w-full bg-white border-2 border-[#e6dfd3] focus:border-[#76151e] rounded-xl px-4 py-2.5 font-mono text-[#3a2a1f] focus:outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#5a4a3f] mb-1">المنفذ (Port)</label>
                <input
                  type="text" value={devicePort} onChange={e => setDevicePort(e.target.value)}
                  className="w-full bg-white border-2 border-[#e6dfd3] focus:border-[#76151e] rounded-xl px-4 py-2.5 font-mono text-[#3a2a1f] focus:outline-none transition-all text-sm"
                />
              </div>
            </div>
          )}

          {/* Error msg */}
          {errMsg && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-red-600">{errMsg}</p>
            </div>
          )}

          {/* Connect / Disconnect */}
          {connStatus !== 'connected' ? (
            <button
              onClick={connect}
              disabled={connStatus === 'scanning' || middlewareOk === false}
              className="flex items-center justify-center gap-2 bg-[#76151e] hover:bg-[#8a1923] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 px-6 rounded-xl transition-all shadow-md"
            >
              {connStatus === 'scanning'
                ? <><Loader2 size={18} className="animate-spin" /> جاري البحث والاتصال...</>
                : <><Search size={18} /> بحث والاتصال بالجهاز</>
              }
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-black text-emerald-700 text-sm">متصل بـ {deviceIp}</p>
                  <p className="text-xs text-emerald-600">{users.length} موظف في الجهاز</p>
                </div>
              </div>
              <button onClick={disconnect}
                className="flex items-center gap-2 bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-600 hover:text-red-600 font-bold py-3 px-4 rounded-xl transition-all text-sm">
                <Unlink size={16} />قطع
              </button>
            </div>
          )}

          {/* After connect: date + employees + pull */}
          {connStatus === 'connected' && (
            <>
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#5a4a3f] mb-1">من تاريخ</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full bg-white border-2 border-[#e6dfd3] focus:border-[#76151e] rounded-xl px-4 py-2.5 text-[#3a2a1f] focus:outline-none transition-all text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-xs font-black text-[#5a4a3f] mb-1">إلى تاريخ</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full bg-white border-2 border-[#e6dfd3] focus:border-[#76151e] rounded-xl px-4 py-2.5 text-[#3a2a1f] focus:outline-none transition-all text-sm font-bold" />
                </div>
              </div>

              {/* Employee selection */}
              {users.length > 0 && dateFrom && dateTo && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-[#5a4a3f] flex items-center gap-1">
                      <Users size={13} />اختيار الموظفين
                    </label>
                    <button
                      onClick={() => { setSelectAll(true); setSelUsers([]); }}
                      className={`text-xs font-black px-3 py-1 rounded-full transition-all
                        ${selectAll ? 'bg-[#76151e] text-white' : 'bg-[#e6dfd3] text-[#5a4a3f] hover:bg-[#76151e] hover:text-white'}`}
                    >كل الموظفين</button>
                  </div>
                  <div className="border border-[#e6dfd3] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {users.map(u => (
                      <div key={u.uid}
                        onClick={() => toggleUser(u.uid)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-[#e6dfd3] last:border-0 transition-all
                          ${!selectAll && selUsers.includes(u.uid) ? 'bg-[#76151e]/5' : 'hover:bg-[#f5f0e8]'}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                          ${!selectAll && selUsers.includes(u.uid) ? 'bg-[#76151e] border-[#76151e]' : 'border-[#d4c4b7]'}`}>
                          {!selectAll && selUsers.includes(u.uid) && <span className="text-white text-[9px] font-black">✓</span>}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-[#76151e]/10 text-[#76151e] flex items-center justify-center font-black text-xs shrink-0">
                          {u.name?.charAt(0) ?? '#'}
                        </div>
                        <span className="font-bold text-[#3a2a1f] text-sm">{u.name || `مستخدم ${u.uid}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pull button */}
              {dateFrom && dateTo && (
                <button
                  onClick={pullData}
                  disabled={pulling || (!selectAll && selUsers.length === 0)}
                  className="w-full flex items-center justify-center gap-2 bg-[#3a2a1f] hover:bg-[#76151e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition-all shadow-md text-base"
                >
                  {pulling
                    ? <><Loader2 size={18} className="animate-spin" /> جاري سحب البيانات...</>
                    : <><Eye size={18} /> سحب البصمات وعرضها</>
                  }
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
