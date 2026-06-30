import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, Search, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { db as defaultDb } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { Footer } from './Footer';

interface PayrollRecord {
  id: string;
  employeeName: string;
  month: string;
  basicSalary: number;
  allowances: number;
  overtime: number;
  deductions: number;
  penalties: number;
  netSalary: number;
  notes?: string;
  createdAt?: any;
}

export default function PayrollPage({ onBack, canEdit = true }: { onBack: () => void; canEdit?: boolean }) {
  const instance = getFirebaseInstance('hr');
  const db = instance?.db || defaultDb;

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [current, setCurrent] = useState<Partial<PayrollRecord>>({
    basicSalary: 0, allowances: 0, overtime: 0, deductions: 0, penalties: 0, netSalary: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const { addToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; name?: string }>({ open: false, id: '' });

  useEffect(() => {
    const q = query(collection(db, 'payroll'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRecord)));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [db]);

  // احسب الصافي تلقائياً
  useEffect(() => {
    const net = (current.basicSalary || 0) + (current.allowances || 0) + (current.overtime || 0)
      - (current.deductions || 0) - (current.penalties || 0);
    setCurrent(prev => ({ ...prev, netSalary: net }));
  }, [current.basicSalary, current.allowances, current.overtime, current.deductions, current.penalties]);

  const handleSave = async () => {
    if (!current.employeeName || !current.month || !current.basicSalary) {
      addToast('يرجى ملء الحقول المطلوبة', 'error'); return;
    }
    try {
      if (modalMode === 'add') {
        await addDoc(collection(db, 'payroll'), { ...current, createdAt: serverTimestamp() });
        addToast('تم إضافة مسير الراتب بنجاح', 'success');
      } else if (current.id) {
        const { id, ...rest } = current as PayrollRecord;
        await updateDoc(doc(db, 'payroll', id), rest);
        addToast('تم التحديث بنجاح', 'success');
      }
      setIsModalOpen(false);
      setCurrent({ basicSalary: 0, allowances: 0, overtime: 0, deductions: 0, penalties: 0, netSalary: 0 });
    } catch (e: any) { addToast('حدث خطأ: ' + e.message, 'error'); }
  };

  const handleDelete = async (id: string) => {

    await deleteDoc(doc(db, 'payroll', id));
    addToast('تم الحذف', 'success');
  };

  const months = [...new Set(records.map(r => r.month))].sort().reverse();
  const filtered = records
    .filter(r => !filterMonth || r.month === filterMonth)
    .filter(r => r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalNet = filtered.reduce((s, r) => s + (r.netSalary || 0), 0);
  const totalBasic = filtered.reduce((s, r) => s + (r.basicSalary || 0), 0);

  const numField = (key: keyof PayrollRecord, label: string, color = '') => (
    <div key={key}>
      <label className={`block text-sm font-bold mb-1 ${color || 'text-[#3a2a1f]'}`}>{label}</label>
      <input type="number" min="0" value={(current as any)[key] || 0}
        onChange={e => setCurrent({ ...current, [key]: Number(e.target.value) })}
        className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
    </div>
  );

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f]">بي رول - مسير الرواتب</h1>
        {canEdit && <button onClick={() => { setModalMode('add'); setCurrent({ basicSalary: 0, allowances: 0, overtime: 0, deductions: 0, penalties: 0, netSalary: 0 }); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-[#76151e] text-white px-5 py-2.5 rounded-full font-bold shadow-md hover:bg-[#8a1923] transition-all">
          <Plus size={20} /><span>إضافة</span>
        </button>}
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 z-10 relative pb-12">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-emerald-700 font-bold text-sm mb-1">إجمالي الرواتب الأساسية</p>
            <p className="text-2xl font-black text-emerald-600">{totalBasic.toLocaleString()} جنيه</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-blue-700 font-bold text-sm mb-1">إجمالي الصافي</p>
            <p className="text-2xl font-black text-blue-600">{totalNet.toLocaleString()} جنيه</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a6a5f]" size={18} />
            <input type="text" placeholder="بحث باسم الموظف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/60 border border-[#d4c4b7] rounded-2xl pr-11 pl-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="bg-white/60 border border-[#d4c4b7] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-[#5a4a3f]">
            <option value="">كل الشهور</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-[#7a6a5f] font-bold">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#7a6a5f] font-bold">لا توجد سجلات</div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#76151e] text-white">
                  {['الموظف', 'الشهر', 'الأساسي', 'البدلات', 'أوفر تايم', 'الخصومات', 'الجزاءات', 'الصافي', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-center font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white/40' : 'bg-[#faf7f3]'}>
                    <td className="px-4 py-3 text-center font-bold">{r.employeeName}</td>
                    <td className="px-4 py-3 text-center">{r.month}</td>
                    <td className="px-4 py-3 text-center text-emerald-700 font-bold">{r.basicSalary?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-blue-700">{r.allowances?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-purple-700">{r.overtime?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-red-600">{r.deductions?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-orange-600">{r.penalties?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center font-black text-[#76151e] text-base">{r.netSalary?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => { setModalMode('edit'); setCurrent(r); setIsModalOpen(true); }} className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#e0dcd0] rounded-3xl p-8 shadow-2xl w-full max-w-lg border border-white/60 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#3a2a1f]">{modalMode === 'add' ? 'إضافة مسير راتب' : 'تعديل'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-white/40"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">اسم الموظف</label>
                <input type="text" value={current.employeeName || ''} onChange={e => setCurrent({ ...current, employeeName: e.target.value })}
                  className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">الشهر</label>
                <input type="month" value={current.month || ''} onChange={e => setCurrent({ ...current, month: e.target.value })}
                  className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {numField('basicSalary', 'الراتب الأساسي', 'text-emerald-700')}
                {numField('allowances', 'البدلات', 'text-blue-700')}
                {numField('overtime', 'أوفر تايم', 'text-purple-700')}
                {numField('deductions', 'الخصومات', 'text-red-600')}
                {numField('penalties', 'الجزاءات', 'text-orange-600')}
              </div>
              <div className="bg-[#76151e]/10 rounded-2xl p-4 text-center border-2 border-[#76151e]/20">
                <p className="text-sm font-bold text-[#5a4a3f] mb-1">صافي الراتب</p>
                <p className="text-3xl font-black text-[#76151e]">{current.netSalary?.toLocaleString()} جنيه</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">ملاحظات</label>
                <input type="text" value={current.notes || ''} onChange={e => setCurrent({ ...current, notes: e.target.value })}
                  className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
              </div>
            </div>
            <button onClick={handleSave} className="w-full mt-6 bg-[#76151e] text-white py-3 rounded-2xl font-bold text-lg hover:bg-[#8a1923] transition-all flex items-center justify-center gap-2">
              <Save size={20} /><span>حفظ</span>
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="حذف مسير الراتب"
        message="هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع."
        onConfirm={() => { doDelete(confirmDelete.id); setConfirmDelete({ open: false, id: '' }); }}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
    </div>
  );
}