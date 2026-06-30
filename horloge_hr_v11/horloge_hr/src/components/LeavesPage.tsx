import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Eye, Pencil, Save, X, Calendar, Building2, AlertCircle } from 'lucide-react';
import { Footer, HeaderOrnaments } from './Footer';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { format } from 'date-fns';

interface Employee {
  id: string;
  name: string;
  jobTitle?: string;
  branch?: string;
  status?: string;
  sortOrder?: number;
  annualLeaveBalance?: number;
}

interface LeaveRecord {
  id: string;
  employeeName: string;
  date: string;
}

interface Props {
  onBack: () => void;
}

/* ─── tiny self-contained toast ─── */
function useSimpleToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = useCallback((text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }, []);
  return { msg, show };
}

export default function LeavesPage({ onBack }: Props) {
  // أولوية: قاعدة بيانات الإجازات المخصصة (لو محددة) → قاعدة بيانات شؤون الموظفين/البصمة → الافتراضية
  const leavesInstance = getFirebaseInstance('leaves');
  const hrInstance      = getFirebaseInstance('hr');
  const fpInstance      = getFirebaseInstance('fingerprint-analysis');
  const dbForEmps        = leavesInstance?.db || hrInstance?.db || db;
  const dbForFp          = leavesInstance?.db || fpInstance?.db || db;

  const { msg, show } = useSimpleToast();

  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [viewEmp,   setViewEmp]   = useState<Employee | null>(null);
  const [editEmp,   setEditEmp]   = useState<Employee | null>(null);
  const [editBal,   setEditBal]   = useState('');
  const [saving,    setSaving]    = useState(false);

  /* ── load data ── */
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 8000);

    let u1: (() => void) | undefined;
    let u2: (() => void) | undefined;

    try {
      u1 = onSnapshot(
        collection(dbForEmps, 'employees'),
        snap => {
          clearTimeout(t);
          setEmployees(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() } as Employee))
              .filter(e => e.status !== 'resigned' && e.name)
              .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
          );
          setLoading(false);
        },
        () => { clearTimeout(t); setLoading(false); }
      );
    } catch { clearTimeout(t); setLoading(false); }

    try {
      u2 = onSnapshot(
        collection(dbForFp, 'fingerprints'),
        snap => {
          setLeaveRecords(
            snap.docs
              .filter(d => d.data().status === 'annual')
              .map(d => ({
                id: d.id,
                employeeName: d.data().employeeName || '',
                date: d.data().date || '',
              }))
          );
        },
        () => {}
      );
    } catch { /* ignore fp errors */ }

    return () => { clearTimeout(t); u1?.(); u2?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);          // ← empty deps: dbForEmps/dbForFp are stable refs per session

  /* ── helpers ── */
  const usedDays   = (emp: Employee) => leaveRecords.filter(r => r.employeeName === emp.name).length;
  const balance    = (emp: Employee) => emp.annualLeaveBalance ?? 0;
  const remaining  = (emp: Employee) => balance(emp) - usedDays(emp);
  const lastLeaves = (emp: Employee) =>
    leaveRecords
      .filter(r => r.employeeName === emp.name)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

  const fmtDate = (s: string) => { try { return format(new Date(s), 'yyyy/MM/dd'); } catch { return s; } };

  /* ── save balance ── */
  const saveEdit = async () => {
    if (!editEmp) return;
    const val = parseInt(editBal, 10);
    if (isNaN(val) || val < 0) { show('أدخل رصيد صحيح', false); return; }
    setSaving(true);
    try {
      await updateDoc(doc(dbForEmps, 'employees', editEmp.id), { annualLeaveBalance: val });
      show('تم تحديث الرصيد');
      setEditEmp(null);
    } catch {
      show('فشل الحفظ، تحقق من الاتصال', false);
    } finally { setSaving(false); }
  };

  /* ── render ── */
  return (
    <div dir="rtl" className="flex-1 flex flex-col font-sans relative">
      {/* Toast */}
      {msg && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm text-white ${msg.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* bg blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-5 z-10 relative">
        <HeaderOrnaments />
        <button onClick={onBack}
          className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-4 py-2 rounded-full shadow-sm transition-all relative z-10">
          <ChevronLeft size={26} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-black text-[#3a2a1f] relative z-10">الإجازات السنوية</h1>
        <div className="w-28 relative z-10" />
      </div>

      {/* Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 z-10 relative pb-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-[#76151e] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <p className="text-center py-24 text-[#a09080] font-bold">لا يوجد موظفون مسجلون</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Column labels */}
            <div className="grid grid-cols-12 gap-2 px-4 text-xs font-black text-[#7a6a5f] uppercase tracking-wider">
              <span className="col-span-5">الموظف</span>
              <span className="col-span-2 text-center">الرصيد</span>
              <span className="col-span-2 text-center">مستخدم</span>
              <span className="col-span-2 text-center">متبقي</span>
              <span className="col-span-1" />
            </div>

            {employees.map(emp => {
              const rem      = remaining(emp);
              const overdrawn = rem < 0;
              return (
                <div key={emp.id} className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4 grid grid-cols-12 gap-2 items-center">
                  {/* Name */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#76151e] text-white flex items-center justify-center font-black text-lg shrink-0">
                      {emp.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[#3a2a1f] truncate">{emp.name}</p>
                      <p className="text-xs text-[#a09080] font-bold truncate">
                        {emp.jobTitle || '—'}{emp.branch ? ` · ${emp.branch}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Balance */}
                  <div className="col-span-2 text-center">
                    <p className="text-xl font-black text-[#3a2a1f]">{balance(emp)}</p>
                    <p className="text-[10px] text-[#a09080] font-bold">يوم</p>
                  </div>
                  {/* Used */}
                  <div className="col-span-2 text-center">
                    <p className="text-xl font-black text-[#76151e]">{usedDays(emp)}</p>
                    <p className="text-[10px] text-[#a09080] font-bold">يوم</p>
                  </div>
                  {/* Remaining */}
                  <div className="col-span-2 text-center">
                    <p className={`text-xl font-black ${overdrawn ? 'text-red-600' : 'text-emerald-700'}`}>
                      {overdrawn ? `−${Math.abs(rem)}` : rem}
                    </p>
                    {overdrawn
                      ? <p className="text-[9px] text-red-500 font-bold flex items-center justify-center gap-0.5"><AlertCircle size={9} />تجاوز</p>
                      : <p className="text-[10px] text-[#a09080] font-bold">يوم</p>
                    }
                  </div>
                  {/* Actions */}
                  <div className="col-span-1 flex flex-col gap-1.5 items-end">
                    <button onClick={() => setViewEmp(emp)}
                      className="w-8 h-8 rounded-xl bg-[#f0ebe3] border border-[#d4c4b7] text-[#76151e] flex items-center justify-center hover:bg-[#76151e] hover:text-white transition-all">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => { setEditEmp(emp); setEditBal(String(balance(emp))); }}
                      className="w-8 h-8 rounded-xl bg-[#f0ebe3] border border-[#d4c4b7] text-[#3a2a1f] flex items-center justify-center hover:bg-[#3a2a1f] hover:text-white transition-all">
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      {/* ── VIEW MODAL ── */}
      {viewEmp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setViewEmp(null)}>
          <div className="bg-[#f5f0e8] rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#d4c4b7]">
              <h2 className="text-xl font-black text-[#3a2a1f]">تفاصيل الإجازات</h2>
              <button onClick={() => setViewEmp(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center hover:bg-red-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              {/* emp info */}
              <div className="bg-white/60 rounded-2xl p-4 border border-white/60">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#76151e] text-white flex items-center justify-center font-black text-xl shrink-0">{viewEmp.name?.charAt(0) ?? '?'}</div>
                  <div>
                    <p className="font-black text-[#3a2a1f] text-lg">{viewEmp.name}</p>
                    <p className="text-sm text-[#7a6a5f] font-bold">{viewEmp.jobTitle || '—'}</p>
                  </div>
                </div>
                {viewEmp.branch && (
                  <div className="flex items-center gap-2 text-sm text-[#7a6a5f] font-bold mt-3">
                    <Building2 size={14} /><span>{viewEmp.branch}</span>
                  </div>
                )}
              </div>
              {/* stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'الرصيد الكلي',  val: String(balance(viewEmp)),   cls: 'text-[#3a2a1f]', bg: 'bg-white/70' },
                  { label: 'المستخدم',       val: String(usedDays(viewEmp)),  cls: 'text-[#76151e]', bg: 'bg-red-50/70' },
                  {
                    label: 'المتبقي',
                    val: remaining(viewEmp) < 0 ? `−${Math.abs(remaining(viewEmp))}` : String(remaining(viewEmp)),
                    cls: remaining(viewEmp) < 0 ? 'text-red-600' : 'text-emerald-700',
                    bg:  remaining(viewEmp) < 0 ? 'bg-red-50/70'  : 'bg-emerald-50/70',
                  },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-2xl p-3 text-center border border-white/60`}>
                    <p className={`text-2xl font-black ${item.cls}`}>{item.val}</p>
                    <p className="text-[11px] text-[#a09080] font-bold mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
              {/* leaves list */}
              <div>
                <h3 className="font-black text-[#3a2a1f] mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-[#76151e]" />
                  آخر {Math.min(lastLeaves(viewEmp).length, 10)} إجازات
                </h3>
                {lastLeaves(viewEmp).length === 0 ? (
                  <p className="text-center py-6 text-[#a09080] font-bold text-sm">لم تُسجَّل أي إجازات بعد</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lastLeaves(viewEmp).map((lv, i) => (
                      <div key={lv.id} className="flex items-center gap-3 bg-white/50 rounded-xl px-4 py-3 border border-white/60">
                        <div className="w-6 h-6 rounded-full bg-[#76151e]/10 text-[#76151e] flex items-center justify-center text-xs font-black shrink-0">{i + 1}</div>
                        <p className="flex-1 text-sm font-bold text-[#3a2a1f]">{fmtDate(lv.date)}</p>
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">إجازة سنوية</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editEmp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditEmp(null)}>
          <div className="bg-[#f5f0e8] rounded-3xl shadow-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[#d4c4b7]">
              <h2 className="text-xl font-black text-[#3a2a1f]">تعديل رصيد الإجازات</h2>
              <button onClick={() => setEditEmp(null)} className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center hover:bg-red-100 transition-all"><X size={18} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-white/60 rounded-2xl p-3 border border-white/60">
                <p className="font-black text-[#3a2a1f]">{editEmp.name}</p>
                <p className="text-sm text-[#7a6a5f] font-bold">{editEmp.jobTitle || '—'}{editEmp.branch ? ` · ${editEmp.branch}` : ''}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#76151e]/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-[#76151e]">{usedDays(editEmp)}</p>
                  <p className="text-xs text-[#7a6a5f] font-bold">مستخدم</p>
                </div>
                <div className={`${remaining(editEmp) < 0 ? 'bg-red-50' : 'bg-emerald-50'} rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-black ${remaining(editEmp) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {remaining(editEmp) < 0 ? `−${Math.abs(remaining(editEmp))}` : remaining(editEmp)}
                  </p>
                  <p className="text-xs text-[#7a6a5f] font-bold">متبقي</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-black text-[#3a2a1f] mb-2">الرصيد السنوي (أيام)</label>
                <input type="number" min={0} value={editBal}
                  onChange={e => setEditBal(e.target.value)}
                  className="w-full bg-white/70 border-2 border-[#d4c4b7] focus:border-[#76151e] rounded-2xl px-4 py-3 text-2xl font-black text-[#3a2a1f] text-center focus:outline-none transition-all" />
              </div>
              <button onClick={saveEdit} disabled={saving}
                className="w-full bg-[#76151e] hover:bg-[#8a1923] disabled:opacity-60 text-white py-3 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all">
                {saving
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><Save size={18} /><span>حفظ الرصيد</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
