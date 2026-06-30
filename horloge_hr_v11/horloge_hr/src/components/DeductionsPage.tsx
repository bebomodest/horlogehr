import React, { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Pencil, Trash2, X, Save, Search, Eye, AlertCircle, Filter } from 'lucide-react';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { logActivity } from './NotificationsPage';
import { db as defaultDb } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { Footer } from './Footer';

interface Deduction {
  id: string;
  employeeName: string;
  type: 'deduction' | 'penalty' | 'bonus';
  unit: 'days' | 'money';
  amount: number;
  reason: string;
  date: string;
  createdAt?: any;
}

interface Employee {
  id: string;
  name: string;
}

export default function DeductionsPage({ onBack, canEdit = true }: { onBack: () => void; canEdit?: boolean }) {
  const instance = getFirebaseInstance('hr');
  const db = instance?.db || defaultDb;

  const [records, setRecords] = useState<Deduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [current, setCurrent] = useState<Partial<Deduction>>({ type: 'deduction', unit: 'days', amount: 0.5 });

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deduction' | 'penalty' | 'bonus'>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { addToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; name?: string }>({ open: false, id: '' });

  // Load employees
  useEffect(() => {
    getDocs(collection(db, 'employees')).then(snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, name: d.data().name, sortOrder: d.data().sortOrder ?? 9999, status: d.data().status }))
        .filter(e => e.name && e.status !== 'resigned')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
      setEmployees(list.map(e => ({ id: e.id, name: e.name })));
    });
  }, [db]);

  // Load deductions
  useEffect(() => {
    const q = query(collection(db, 'deductions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as Deduction)));
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, [db]);

  const handleSave = async () => {
    if (!current.employeeName || !current.amount || !current.date || (current.type !== 'bonus' && !current.reason)) {
      addToast('يرجى ملء جميع الحقول', 'error');
      return;
    }
    try {
      if (modalMode === 'add') {
        await addDoc(collection(db, 'deductions'), { ...current, createdAt: serverTimestamp() });
        addToast(`تم إضافة ${current.type === 'deduction' ? 'الخصم' : 'الجزاء'} بنجاح`, 'success');
        logActivity(db, `إضافة ${current.type === 'deduction' ? 'خصم' : current.type === 'penalty' ? 'جزاء' : 'إضافة بدل'}`, `تم إضافة للموظف: ${current.employeeName}`, 'النظام', 'deduction');
      } else if (modalMode === 'edit' && current.id) {
        const { id, ...rest } = current as Deduction;
        await updateDoc(doc(db, 'deductions', id), rest);
        addToast('تم التحديث بنجاح', 'success');
      }
      setIsModalOpen(false);
      setCurrent({ type: 'deduction', daysCount: 1 });
    } catch (e: any) {
      addToast('حدث خطأ: ' + e.message, 'error');
    }
  };

  const handleDelete = async (id: string) => {

    await deleteDoc(doc(db, 'deductions', id));
    addToast('تم الحذف بنجاح', 'success');
  };

  // Apply filters
  const filtered = records.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterEmployee && r.employeeName !== filterEmployee) return false;
    if (filterFrom && r.date < filterFrom) return false;
    if (filterTo && r.date > filterTo) return false;
    if (searchTerm && !r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) && !r.reason?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const totalDeductionDays = filtered.filter(r => r.type === 'deduction' && r.unit === 'days').reduce((s, r) => s + (r.amount || 0), 0);
  const totalDeductionMoney = filtered.filter(r => r.type === 'deduction' && r.unit === 'money').reduce((s, r) => s + (r.amount || 0), 0);
  const totalPenaltyDays = filtered.filter(r => r.type === 'penalty' && r.unit === 'days').reduce((s, r) => s + (r.amount || 0), 0);
  const totalPenaltyMoney = filtered.filter(r => r.type === 'penalty' && r.unit === 'money').reduce((s, r) => s + (r.amount || 0), 0);
  const totalBonusDays = filtered.filter(r => r.type === 'bonus' && r.unit === 'days').reduce((s, r) => s + (r.amount || 0), 0);
  const totalBonusMoney = filtered.filter(r => r.type === 'bonus' && r.unit === 'money').reduce((s, r) => s + (r.amount || 0), 0);

  const openAdd = () => {
    setModalMode('add');
    setCurrent({ type: 'deduction', unit: 'days', amount: 0.5, date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const openView = (r: Deduction) => { setModalMode('view'); setCurrent(r); setIsModalOpen(true); };
  const openEdit = (r: Deduction) => { setModalMode('edit'); setCurrent(r); setIsModalOpen(true); };

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f]">الخصومات والجزاءات</h1>
        {canEdit && <button onClick={openAdd} className="flex items-center gap-2 bg-[#76151e] text-white px-5 py-2.5 rounded-full font-bold shadow-md hover:bg-[#8a1923] transition-all">
          <Plus size={20} /><span>إضافة</span>
        </button>}
        {canEdit && (
          <button onClick={() => {
            setModalMode('add');
            setCurrent({ type: 'bonus', unit: 'days', amount: 0.5, date: new Date().toISOString().split('T')[0] });
            setIsModalOpen(true);
          }} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-full font-bold shadow-md hover:bg-emerald-700 transition-all text-sm">
            <Plus size={18} /><span>إضافة بدل</span>
          </button>
        )}
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 z-10 relative pb-12">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-red-700 font-bold text-sm mb-1">خصومات</p>
            <p className="text-xl font-black text-red-600">{totalDeductionDays} يوم</p>
            <p className="text-sm font-bold text-red-500">{totalDeductionMoney.toLocaleString()} جنيه</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-orange-700 font-bold text-sm mb-1">جزاءات</p>
            <p className="text-xl font-black text-orange-600">{totalPenaltyDays} يوم</p>
            <p className="text-sm font-bold text-orange-500">{totalPenaltyMoney.toLocaleString()} جنيه</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center shadow-sm">
            <p className="text-emerald-700 font-bold text-sm mb-1">إضافة بدل</p>
            <p className="text-xl font-black text-emerald-600">{totalBonusDays} يوم</p>
            <p className="text-sm font-bold text-emerald-500">{totalBonusMoney.toLocaleString()} جنيه</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm mb-5 space-y-3">
          <div className="flex items-center gap-2 text-[#76151e] font-bold mb-2">
            <Filter size={18} /><span>تصفية النتائج</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6a5f]" size={16} />
              <input type="text" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl pr-9 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
            </div>
            {/* Employee filter */}
            <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
              className="bg-white/60 border border-[#d4c4b7] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-[#5a4a3f]">
              <option value="">كل الموظفين</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            {/* Type filter */}
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
              className="bg-white/60 border border-[#d4c4b7] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-[#5a4a3f]">
              <option value="all">الكل</option>
              <option value="deduction">خصومات فقط</option>
              <option value="penalty">جزاءات فقط</option>
            </select>
            {/* Date from */}
            <div className="flex gap-2 col-span-2 sm:col-span-1">
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="flex-1 bg-white/60 border border-[#d4c4b7] rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="flex-1 bg-white/60 border border-[#d4c4b7] rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
            </div>
          </div>
          {(filterEmployee || filterType !== 'all' || filterFrom || filterTo || searchTerm) && (
            <button onClick={() => { setFilterEmployee(''); setFilterType('all'); setFilterFrom(''); setFilterTo(''); setSearchTerm(''); }}
              className="text-xs text-[#76151e] font-bold hover:underline">
              ✕ مسح الفلاتر
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-[#7a6a5f] font-bold text-xl">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#7a6a5f] font-bold text-xl">لا توجد سجلات</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(r => (
              <div key={r.id} className="bg-white/60 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-md flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 ${
                    r.type === 'deduction' ? 'bg-red-100 text-red-600' :
                    r.type === 'penalty' ? 'bg-orange-100 text-orange-600' :
                    'bg-emerald-100 text-emerald-600'}`}>
                    {r.type === 'deduction' ? 'خ' : r.type === 'penalty' ? 'ج' : '✚'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#3a2a1f] text-lg">{r.employeeName}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        r.type === 'deduction' ? 'bg-red-100 text-red-600' :
                        r.type === 'penalty' ? 'bg-orange-100 text-orange-600' :
                        'bg-emerald-100 text-emerald-600'}`}>
                        {r.type === 'deduction' ? 'خصم' : r.type === 'penalty' ? 'جزاء' : 'إضافة بدل'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.unit === 'days' ? 'bg-[#76151e]/10 text-[#76151e]' : 'bg-emerald-100 text-emerald-700'}`}>
                        {r.unit === 'days' ? `${r.amount} يوم` : `${r.amount?.toLocaleString()} جنيه`}
                      </span>
                    </div>
                    <p className="text-[#7a6a5f] text-sm truncate mt-0.5">{r.reason}</p>
                    <p className="text-[#9a8a7f] text-xs mt-0.5">{r.date}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openView(r)} className="p-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all" title="عرض">
                    <Eye size={16} />
                  </button>
                  {canEdit && <button onClick={() => openEdit(r)} className="p-2 rounded-xl bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all" title="تعديل">
                    <Pencil size={16} />
                  </button>}
                  {canEdit && <button onClick={() => handleDelete(r.id)} className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-all" title="حذف">
                    <Trash2 size={16} />
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#e0dcd0] rounded-3xl p-8 shadow-2xl w-full max-w-md border border-white/60">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#3a2a1f]">
                {modalMode === 'add' ? (current.type === 'bonus' ? 'إضافة بدل' : 'إضافة خصم / جزاء') : modalMode === 'edit' ? 'تعديل البيانات' : 'عرض البيانات'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-white/40 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-2">النوع</label>
                <div className="flex gap-3">
                  {(['deduction', 'penalty'] as const).map(t => (
                    <button key={t} disabled={modalMode === 'view'}
                      onClick={() => setCurrent({ ...current, type: t })}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all ${current.type === t ? (t === 'deduction' ? 'bg-red-500 text-white shadow-md' : 'bg-orange-500 text-white shadow-md') : 'bg-white/60 text-[#5a4a3f]'} disabled:cursor-default`}>
                      {t === 'deduction' ? '🔴 خصم' : '🟠 جزاء'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Employee */}
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">اسم الموظف <span className="text-red-500">*</span></label>
                {modalMode === 'view' ? (
                  <p className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{current.employeeName}</p>
                ) : (
                  <select value={current.employeeName || ''} onChange={e => setCurrent({ ...current, employeeName: e.target.value })}
                    className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-[#3a2a1f]">
                    <option value="">-- اختر الموظف --</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                )}
              </div>

              {/* Unit selector - only for deduction/penalty */}
              {current.type !== 'bonus' && (
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-2">نوع القيمة <span className="text-red-500">*</span></label>
                  {modalMode === 'view' ? (
                    <p className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold">
                      {current.unit === 'days' ? '📅 أيام' : '💰 مبلغ مالي'}
                    </p>
                  ) : (
                    <div className="flex gap-3">
                      {[{ id: 'days', label: '📅 أيام' }, { id: 'money', label: '💰 مبلغ مالي' }].map(u => (
                        <button key={u.id} type="button"
                          onClick={() => setCurrent({ ...current, unit: u.id as 'days' | 'money', amount: u.id === 'days' ? 0.5 : 0 })}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${current.unit === u.id ? 'bg-[#76151e] text-white shadow-md' : 'bg-white/60 text-[#5a4a3f] border border-[#d4c4b7]'}`}>
                          {u.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">
                  {current.type === 'bonus' ? 'عدد الأيام (بدل)' : current.unit === 'days' ? 'عدد الأيام' : 'المبلغ (جنيه)'} <span className="text-red-500">*</span>
                </label>
                {modalMode === 'view' ? (
                  <p className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-emerald-600 text-xl">
                    {current.type === 'bonus' ? `${current.amount} يوم بدل` : current.unit === 'days' ? `${current.amount} يوم` : `${current.amount?.toLocaleString()} جنيه`}
                  </p>
                ) : (
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={current.amount || ''}
                    onChange={e => setCurrent({ ...current, amount: Number(e.target.value) })}
                    className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e] text-xl font-bold text-[#76151e]"
                    placeholder="مثال: 0.5 أو 1 أو 2"
                  />
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">التاريخ <span className="text-red-500">*</span></label>
                {modalMode === 'view' ? (
                  <p className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold">{current.date}</p>
                ) : (
                  <input type="date" value={current.date || ''}
                    onChange={e => setCurrent({ ...current, date: e.target.value })}
                    className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-bold text-[#3a2a1f] mb-1">
                  {current.type === 'bonus' ? 'ملاحظات (اختياري)' : <>سبب الخصم / الجزاء <span className="text-red-500">*</span></>}
                </label>
                {modalMode === 'view' ? (
                  <p className="bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] min-h-[100px] whitespace-pre-wrap">{current.reason}</p>
                ) : (
                  <textarea value={current.reason || ''} rows={4}
                    onChange={e => setCurrent({ ...current, reason: e.target.value })}
                    placeholder={current.type === 'bonus' ? 'اكتب سبب البدل أو أي ملاحظات...' : 'اكتب سبب الخصم أو الجزاء بالتفصيل...'}
                    className="w-full bg-white/60 border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e] resize-none" />
                )}
              </div>
            </div>

            {modalMode !== 'view' && (
              <button onClick={handleSave} className="w-full mt-6 bg-[#76151e] text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-[#8a1923] transition-all flex items-center justify-center gap-2 shadow-lg">
                <Save size={20} /><span>حفظ</span>
              </button>
            )}

            {modalMode === 'view' && (
              <button onClick={() => setModalMode('edit')} className="w-full mt-6 bg-amber-500 text-white py-3.5 rounded-2xl font-bold text-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg">
                <Pencil size={20} /><span>تعديل</span>
              </button>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmDelete.open}
        title="حذف السجل"
        message="هل أنت متأكد من حذف هذا الخصم / الجزاء؟ لا يمكن التراجع."
        onConfirm={() => { doDelete(confirmDelete.id); setConfirmDelete({ open: false, id: '' }); }}
        onCancel={() => setConfirmDelete({ open: false, id: '' })}
      />
    </div>
  );
}