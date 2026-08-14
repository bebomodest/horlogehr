import React, { useState, useEffect } from 'react';
import { ChevronLeft, Search, Calendar, User, Loader2, Save, Trash2, Plus, X, AlertCircle, ChevronUp, ChevronDown, Fingerprint } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, getDocs, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { logActivity } from './NotificationsPage';
import { Footer } from './Footer';

interface FingerprintLog { time: string; type: string; }
interface FingerprintRecord {
  id: string;
  employeeName: string;
  fingerprintName: string;
  employeeJobTitle: string;
  date: string;
  logs: FingerprintLog[];
  notes: string;
  status?: string;
  shiftInfo?: { name: string; startTime: string; endTime: string; };
  uid: string;
  updatedAt?: any;
}
interface Employee { id: string; name: string; fingerprintName?: string; }

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ViewEditFingerprint({ onBack, canEdit = true }: { onBack: () => void; canEdit?: boolean }) {
  const { addToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; name?: string }>({ open: false, id: '' });
  const dynamicInstance = getFirebaseInstance('fingerprint-analysis');
  const hrInstance = getFirebaseInstance('hr');
  const dbToUse = dynamicInstance?.db || db;
  const dbForEmps = hrInstance?.db || db;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 8) + '01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingRecords, setEditingRecords] = useState<FingerprintRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    getDocs(query(collection(dbForEmps, 'employees'))).then(snap => {
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Employee))
        .filter(e => e.name && (e as any).status !== 'resigned')
        .sort((a, b) =>
          ((a as any).sortOrder ?? 9999) - ((b as any).sortOrder ?? 9999) ||
          a.name.localeCompare(b.name, 'ar')
        );
      setEmployees(sorted);
      setLoadingEmployees(false);
    }).catch(() => setLoadingEmployees(false));
  }, [dbForEmps]);

  const handleSearch = async () => {
    if (!startDate || !endDate) { addToast('يرجى اختيار الفترة الزمنية', 'error'); return; }
    setIsSearching(true); setHasSearched(true);
    try {
      const snap = await getDocs(query(collection(dbToUse, 'fingerprints')));
      const all: FingerprintRecord[] = snap.docs.map(d => {
        const data = d.data();
        // Normalize logs - handle both {time, type} and {timeStr, ...} formats
        const logs = (data.logs || []).map((l: any) => ({
          time: l.time || l.timeStr || '',
          type: l.type || 'manual'
        })).filter((l: any) => l.time); // Remove empty logs
        return { id: d.id, ...data, logs } as FingerprintRecord;
      });
      const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
      const filtered = all.filter(r => {
        if (r.date < startDate || r.date > endDate) return false;
        if (selectedEmp && r.employeeName !== selectedEmp.name) return false;
        return true;
      }).sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
      setEditingRecords(JSON.parse(JSON.stringify(filtered)));
      setHasUnsaved(false);
      if (filtered.length === 0) addToast('لم يتم العثور على سجلات في هذه الفترة', 'info');
    } catch (e) {
      console.error(e);
      addToast('حدث خطأ أثناء البحث', 'error');
    } finally { setIsSearching(false); }
  };

  const handleLogChange = (ri: number, li: number, field: keyof FingerprintLog, val: string) => {
    const recs = [...editingRecords];
    recs[ri].logs[li][field] = val;
    setEditingRecords(recs);
    setHasUnsaved(true);
  };

  const handleMoveLog = (ri: number, li: number, dir: 'up' | 'down') => {
    const recs = [...editingRecords];
    const logs = [...recs[ri].logs];
    setHasUnsaved(true);
    const swapIdx = dir === 'up' ? li - 1 : li + 1;
    if (swapIdx < 0 || swapIdx >= logs.length) return;
    [logs[li], logs[swapIdx]] = [logs[swapIdx], logs[li]];
    recs[ri].logs = logs;
    setEditingRecords(recs);
  };

  const handleSave = async () => {
    setIsSaving(true);
    addToast('جاري الحفظ...', 'info');
    try {
      for (const record of editingRecords) {
        const { id, ...data } = record;
        await setDoc(doc(dbToUse, 'fingerprints', id), { ...data, updatedAt: serverTimestamp() });
      }
      addToast(`✅ تم حفظ ${editingRecords.length} سجل بنجاح`, 'success');
      setHasUnsaved(false);
      logActivity(dbToUse, 'تعديل بصمات', `تم تعديل وحفظ ${editingRecords.length} سجل بصمة`, 'النظام', 'edit');
    } catch (e) {
      addToast('حدث خطأ أثناء الحفظ', 'error');
    } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {

    await deleteDoc(doc(dbToUse, 'fingerprints', id));
    setEditingRecords(editingRecords.filter(r => r.id !== id));
    addToast('تم الحذف بنجاح', 'success');
    logActivity(dbToUse, 'حذف بصمة', `تم حذف سجل بصمة`, 'النظام', 'delete');
  };

  return (
    <div dir="rtl" className="min-h-screen w-full flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f]">عرض / تعديل بصمة</h1>
        <div className="w-24" />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 z-10 relative pb-12">
        {/* Search */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 mb-6 shadow-lg border border-white/60">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-[#7a6a5f] mb-1">الموظف</label>
              <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold">
                <option value="">كل الموظفين</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#7a6a5f] mb-1">من تاريخ</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#7a6a5f] mb-1">إلى تاريخ</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold" />
            </div>
            <button onClick={handleSearch} disabled={isSearching}
              className="bg-[#76151e] text-white py-3 px-6 rounded-xl font-bold shadow-lg hover:bg-[#8a1923] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              <span>بحث</span>
            </button>
          </div>
        </div>

        {/* Status */}

        {/* Records */}
        {hasSearched && editingRecords.length > 0 && (
          <>
            <div className="space-y-4">
              {editingRecords.map((record, ri) => {
                const dayName = ARABIC_DAYS[new Date(record.date + 'T00:00:00').getDay()];
                return (
                  <div key={record.id} className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-white/60">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                      <div>
                        <p className="text-xl font-bold text-[#3a2a1f]">{record.employeeName}</p>
                        <p className="text-[#7a6a5f] text-sm font-bold">{record.date} — {dayName}</p>
                        {record.shiftInfo && (
                          <p className="text-xs text-[#76151e] font-bold mt-1">الشيفت: {record.shiftInfo.name} ({record.shiftInfo.startTime} - {record.shiftInfo.endTime})</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Leave status selector */}
                        <select
                          value={record.status || 'present'}
                          onChange={e => {
                            const recs = [...editingRecords];
                            recs[ri].status = e.target.value;
                            setEditingRecords(recs);
                          }}
                          className="bg-white/80 border border-[#d4c4b7] rounded-xl px-3 py-2 text-sm font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]"
                        >
                          <option value="present">✅ حضور</option>
                          <option value="annual">📅 إجازة سنوية (تُحتسب كيوم عمل)</option>
                          <option value="paid">🔵 راحة أسبوعية (تُحتسب كيوم عمل)</option>
                          <option value="unexcused">❌ غياب بدون إذن (لا يُحتسب)</option>
                        </select>
                        {canEdit && <button onClick={() => handleDelete(record.id)} className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-all" title="حذف">
                          <Trash2 size={18} />
                        </button>}
                      </div>
                    </div>

                    {/* Logs */}
                    <div className="flex flex-col gap-2">
                      {record.logs.map((log, li) => (
                        <div key={li} className="flex items-center gap-3 bg-white border border-[#e6dfd3] rounded-2xl px-4 py-3 shadow-sm" dir="ltr">
                          <div className="w-8 h-8 rounded-full bg-[#76151e]/10 flex items-center justify-center text-[#76151e]">
                            <Fingerprint size={14} />
                          </div>
                          <input type="time" value={log.time} onChange={e => handleLogChange(ri, li, 'time', e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e]/30" />
                          <select value={log.type} onChange={e => handleLogChange(ri, li, 'type', e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none">
                            <option value="IN">دخول</option>
                            <option value="OUT">خروج</option>
                            <option value="manual">يدوي</option>
                          </select>
                          <div className="flex gap-1 mr-auto" dir="rtl">
                            <button onClick={() => handleMoveLog(ri, li, 'up')} disabled={li === 0} className="p-1 text-[#7a6a5f] hover:text-[#76151e] disabled:opacity-30"><ChevronUp size={14} /></button>
                            <button onClick={() => handleMoveLog(ri, li, 'down')} disabled={li === record.logs.length - 1} className="p-1 text-[#7a6a5f] hover:text-[#76151e] disabled:opacity-30"><ChevronDown size={14} /></button>
                            <button onClick={() => {
                              const recs = [...editingRecords];
                              recs[ri].logs.splice(li, 1);
                              setEditingRecords([...recs]);
                            }} className="p-1 text-red-400 hover:text-red-600"><X size={14} /></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => {
                        const recs = [...editingRecords];
                        recs[ri].logs.push({ time: '09:00', type: 'manual' });
                        setEditingRecords([...recs]);
                      }} className="border-2 border-dashed border-[#d4c4b7] rounded-2xl py-2 text-[#7a6a5f] hover:border-[#76151e] hover:text-[#76151e] transition-all flex items-center justify-center gap-2 font-bold text-sm">
                        <Plus size={16} /><span>إضافة بصمة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save bar */}
            <div className="sticky bottom-6 z-20 flex justify-center mt-8">
              <div className="bg-[#e6e1d6]/90 backdrop-blur-md px-8 py-4 rounded-full shadow-2xl border border-white/60 flex gap-4">
                <button onClick={handleSave} disabled={isSaving}
                  className="bg-[#76151e] text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-[#8a1923] transition-all flex items-center gap-2 disabled:opacity-50">
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  <span>حفظ التعديلات</span>
                </button>
                <button onClick={() => { setEditingRecords([]); setHasSearched(false); setStatusMsg({ text: '', type: '' }); }}
                  className="bg-white text-[#3a2a1f] px-8 py-3 rounded-full font-bold shadow-md border border-[#d4c4b7] hover:bg-stone-50 transition-all flex items-center gap-2">
                  <X size={20} /><span>إلغاء</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
      <ConfirmModal
        isOpen={confirmExit}
        title="تعديلات غير محفوظة"
        message="لديك تعديلات لم يتم حفظها. هل تريد الخروج بدون حفظ؟"
        confirmLabel="خروج بدون حفظ"
        cancelLabel="البقاء والحفظ"
        type="warning"
        onConfirm={() => { setConfirmExit(false); onBack(); }}
        onCancel={() => setConfirmExit(false)}
      />
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="حذف سجل البصمة"
        message="هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع."
        onConfirm={() => { doDelete(confirmDelete.id); setConfirmDelete({ open: false, id: '' }); }}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
    </div>
  );
}
