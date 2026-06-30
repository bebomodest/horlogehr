import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Plus, Pencil, Eye, X, Save, Search, UserPlus, Trash2,
  UserX, UserCheck, Building2, Briefcase, ListOrdered,
  GripVertical, ChevronUp, ChevronDown, FileDown, FileSpreadsheet, Printer,
  Upload, AlertCircle, CheckCircle,
} from 'lucide-react';
import { useToast } from './components/Toast';
import { ConfirmModal } from './components/ConfirmModal';
import { logActivity } from './components/NotificationsPage';
import { db as defaultDb } from './firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { getFirebaseInstance } from './lib/databaseManager';
import { Footer } from './components/Footer';
import { uploadToPath } from './lib/fileStorage';

type Tab = 'active' | 'resigned' | 'branches';

interface Employee {
  id: string;
  name: string;
  fingerprintName: string;
  branch?: string;
  jobTitle?: string;
  status?: 'active' | 'resigned';
  sortOrder?: number;
  createdAt?: any;
  annualLeaveBalance?: number;
}

interface Branch {
  id: string;
  name: string;
  jobs: string[];
}

export default function EmployeeListPage({
  onBack, userFallback, canEdit = true,
}: {
  onBack: () => void; userFallback?: any; canEdit?: boolean;
}) {
  const dynamicInstance = getFirebaseInstance('hr');
  const db = dynamicInstance?.db || defaultDb;
  const { addToast } = useToast();

  const currentUserName: string = (() => {
    try { return JSON.parse(sessionStorage.getItem('hr_user') || '{}').name || 'النظام'; }
    catch { return 'النظام'; }
  })();

  // مزامنة الفرع المختار لقائمة الوظائف مع بيانات الموظف
  const openEmpModal = (mode: 'add' | 'edit' | 'view', emp: Partial<Employee>) => {
    setSelectedBranchForJob(emp.branch || '');
    setEmpModal({ open: true, mode, emp });
  };

  const [tab, setTab] = useState<Tab>('active');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [empModal, setEmpModal] = useState<{ open: boolean; mode: 'add' | 'edit' | 'view'; emp: Partial<Employee> }>({ open: false, mode: 'add', emp: {} });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; name?: string }>({ open: false, id: '' });
  const [resignConfirmId, setResignConfirmId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>('all');

  // نافذة الاستقالة الكاملة
  const [resignModal, setResignModal] = useState<{ id: string; name: string } | null>(null);
  const [resignDate,  setResignDate]  = useState('');
  const [resignFiles, setResignFiles] = useState<{
    letter:    File|null;
    clearance: File|null;
    acquittal: File|null;
  }>({ letter: null, clearance: null, acquittal: null });
  const [resignProgress, setResignProgress] = useState<{ letter:number; clearance:number; acquittal:number }>({ letter:0, clearance:0, acquittal:0 });
  const [isResigning,  setIsResigning]  = useState(false);
  const [resignErr,    setResignErr]    = useState('');
  const resignFileRefs = { letter: useRef<HTMLInputElement>(null), clearance: useRef<HTMLInputElement>(null), acquittal: useRef<HTMLInputElement>(null) };

  const [branchModal, setBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [jobModal, setJobModal] = useState(false);
  const [newJob, setNewJob] = useState({ branchId: '', title: '' });
  const [deleteBranchConfirm, setDeleteBranchConfirm] = useState<string | null>(null);
  const [deleteJobConfirm, setDeleteJobConfirm] = useState<{ branchId: string; job: string } | null>(null);

  const [showSort, setShowSort] = useState(false);
  const [sortDraft, setSortDraft] = useState<{ id: string; name: string; jobTitle: string; branch: string; order: number }[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [isExporting, setIsExporting] = useState<'pdf'|'excel'|'print'|null>(null);

  // حالة الفرع المختار في مودال الموظف — بتضمن تحديث الوظائف فوراً
  const [selectedBranchForJob, setSelectedBranchForJob] = useState('');

  useEffect(() => {
    const empUnsub = onSnapshot(collection(db, 'employees'), snap => {
      const list: Employee[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
      list.sort((a, b) => {
        const ao = a.sortOrder ?? 9999; const bo = b.sortOrder ?? 9999;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '', 'ar');
      });
      setEmployees(list);
      setLoading(false);
    }, () => setLoading(false));

    const branchUnsub = onSnapshot(collection(db, 'branches'), snap => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    });

    return () => { empUnsub(); branchUnsub(); };
  }, [db]);

  const activeEmps = employees.filter(e => e.status !== 'resigned');
  const resignedEmps = employees.filter(e => e.status === 'resigned');

  const filteredActive = activeEmps.filter(e =>
    (!searchTerm || e.name?.includes(searchTerm) || e.jobTitle?.includes(searchTerm) || e.branch?.includes(searchTerm)) &&
    (branchFilter === 'all' || e.branch === branchFilter)
  );
  const filteredResigned = resignedEmps.filter(e =>
    (!searchTerm || e.name?.includes(searchTerm)) &&
    (branchFilter === 'all' || e.branch === branchFilter)
  );

  const saveEmployee = async () => {
    const { name, fingerprintName, branch, jobTitle, id } = empModal.emp;
    if (!name?.trim()) { addToast('اسم الموظف مطلوب', 'error'); return; }
    if (empModal.mode === 'add') {
      const maxOrder = employees.reduce((m, e) => Math.max(m, e.sortOrder || 0), 0);
      await addDoc(collection(db, 'employees'), {
        name: name.trim(), fingerprintName: fingerprintName?.trim() || name.trim(),
        branch: branch || '', jobTitle: jobTitle || '',
        status: 'active', sortOrder: maxOrder + 1, createdAt: serverTimestamp(),
        annualLeaveBalance: 0,
      });
      logActivity(db, 'إضافة موظف', `تم إضافة الموظف: ${name}`, currentUserName, 'employee');
      addToast('تم إضافة الموظف', 'success');
    } else if (empModal.mode === 'edit' && id) {
      await updateDoc(doc(db, 'employees', id), {
        name: name.trim(), fingerprintName: fingerprintName?.trim() || name.trim(),
        branch: branch || '', jobTitle: jobTitle || '',
      });
      logActivity(db, 'تعديل موظف', `تم تعديل: ${name}`, currentUserName, 'employee');
      addToast('تم حفظ التعديلات', 'success');
    }
    setEmpModal({ open: false, mode: 'add', emp: {} });
  };

  const openResignModal = (emp: Employee) => {
    setResignModal({ id: emp.id, name: emp.name });
    setResignDate('');
    setResignFiles({ letter: null, clearance: null, acquittal: null });
    setResignProgress({ letter: 0, clearance: 0, acquittal: 0 });
    setResignErr('');
    setResignConfirmId(null);
  };

  const resignEmployee = async () => {
    if (!resignModal) return;
    if (!resignDate) { setResignErr('يرجى تحديد تاريخ الاستقالة'); return; }
    setIsResigning(true); setResignErr('');
    try {
      const fileTypes = [
        { key: 'letter',    label: 'استقالة' },
        { key: 'clearance', label: 'إقرار مخالصة' },
        { key: 'acquittal', label: 'إقرار تبرئة ذمة' },
      ] as const;

      const filesMetadata: Record<string, any> = {};
      for (const ft of fileTypes) {
        const file = resignFiles[ft.key];
        if (file) {
          const chunks = await uploadToPath(
            db,
            ['resignations', resignModal.id, ft.key],
            file,
            (p) => setResignProgress(prev => ({ ...prev, [ft.key]: p }))
          );
          filesMetadata[ft.key] = { name: file.name, size: file.size, type: file.type, chunks };
        }
      }

      await updateDoc(doc(db, 'employees', resignModal.id), {
        status:            'resigned',
        resignedDate:      resignDate,
        resignationFiles:  filesMetadata,
      });

      logActivity(db, 'تحويل إلى مستقيل', `الموظف: ${resignModal.name} — تاريخ: ${resignDate}`, currentUserName, 'employee');
      addToast('تم تحويل الموظف إلى مستقيل', 'success');
      setResignModal(null);
    } catch (e: any) {
      setResignErr('خطأ: ' + (e.message || 'حاول مرة أخرى'));
    } finally { setIsResigning(false); }
  };

  const reactivateEmployee = async (id: string) => {
    await updateDoc(doc(db, 'employees', id), { status: 'active' });
    logActivity(db, 'إعادة تعيين', `الموظف: ${employees.find(e => e.id === id)?.name}`, currentUserName, 'employee');
    addToast('تم إعادة تعيين الموظف', 'success');
  };

  const deleteEmployee = async (id: string) => {
    const emp = employees.find(e => e.id === id);
    await deleteDoc(doc(db, 'employees', id));
    logActivity(db, 'حذف موظف', `تم حذف: ${emp?.name}`, currentUserName, 'delete');
    addToast('تم حذف الموظف', 'success');
    setConfirmDelete({ open: false, id: '' });
  };

  const addBranch = async () => {
    if (!newBranchName.trim()) { addToast('اسم الفرع مطلوب', 'error'); return; }
    await addDoc(collection(db, 'branches'), { name: newBranchName.trim(), jobs: [] });
    addToast('تم إضافة الفرع', 'success');
    setNewBranchName(''); setBranchModal(false);
  };

  const addJob = async () => {
    const branch = branches.find(b => b.id === newJob.branchId);
    if (!branch || !newJob.title.trim()) { addToast('اختر الفرع وأدخل اسم الوظيفة', 'error'); return; }
    await updateDoc(doc(db, 'branches', branch.id), { jobs: [...branch.jobs, newJob.title.trim()] });
    addToast('تم إضافة الوظيفة', 'success');
    setNewJob({ branchId: '', title: '' }); setJobModal(false);
  };

  const deleteJob = async (branchId: string, job: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    await updateDoc(doc(db, 'branches', branchId), { jobs: branch.jobs.filter(j => j !== job) });
    setDeleteJobConfirm(null);
  };

  const deleteBranch = async (branchId: string) => {
    await deleteDoc(doc(db, 'branches', branchId));
    setDeleteBranchConfirm(null);
  };

  // ─── Export ───────────────────────────────────────────────────────────────
  const buildExportData = () => {
    const headers = ['#', 'اسم الموظف', 'اسم البصمة', 'الفرع', 'الوظيفة', 'الحالة'];
    const rows = activeEmps.map((emp, idx) => [
      idx + 1, emp.name, emp.fingerprintName || emp.name,
      emp.branch || '—', emp.jobTitle || '—', 'نشط',
    ]);
    const statsRows = [
      { label: 'إجمالي الموظفين النشطين', value: String(activeEmps.length) },
      { label: 'إجمالي المستقيلين',        value: String(resignedEmps.length) },
      { label: 'إجمالي الفروع',            value: String(branches.length) },
    ];
    const subtitle = `قائمة الموظفين — ${new Date().toLocaleDateString('ar-EG')}`;
    return { headers, rows, statsRows, subtitle };
  };

  const exportPDF = async () => {
    setIsExporting('pdf');
    try {
      const { buildReportHTML, exportAsPDF } = await import('./lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      const userName = currentUserName;
      const html = await buildReportHTML('قائمة الموظفين', subtitle, userName, 'مسؤول الموارد البشرية', headers, rows, statsRows, 'portrait');
      exportAsPDF(html, 'قائمة-الموظفين.pdf');
    } finally { setIsExporting(null); }
  };

  const exportExcel = async () => {
    setIsExporting('excel');
    try {
      const ExcelJS = await import('exceljs');
      const { exportAsExcel } = await import('./lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      await exportAsExcel(ExcelJS, 'قائمة الموظفين', subtitle, currentUserName, 'مسؤول الموارد البشرية', headers, rows, statsRows, 'قائمة-الموظفين.xlsx');
    } finally { setIsExporting(null); }
  };

  const handlePrint = async () => {
    setIsExporting('print');
    try {
      const { buildReportHTML, exportAsPDF } = await import('./lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      const html = await buildReportHTML('قائمة الموظفين', subtitle, currentUserName, 'مسؤول الموارد البشرية', headers, rows, statsRows, 'portrait');
      exportAsPDF(html, '', true);
    } finally { setIsExporting(null); }
  };

  const openSort = () => {
    setSortDraft(activeEmps.map((emp, idx) => ({
      id: emp.id, name: emp.name, jobTitle: emp.jobTitle || '', branch: emp.branch || '',
      order: emp.sortOrder ?? idx + 1,
    })));
    setShowSort(true);
  };

  const moveSort = (idx: number, dir: 'up' | 'down') => {
    setSortDraft(d => {
      const arr = [...d]; const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  };

  const saveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const batch = writeBatch(db);
      sortDraft.forEach((item, idx) => {
        batch.update(doc(db, 'employees', item.id), { sortOrder: idx + 1 });
      });
      await batch.commit();
      addToast('تم حفظ ترتيب الموظفين', 'success');
      setShowSort(false);
    } catch (e: any) { addToast('خطأ: ' + e.message, 'error'); }
    finally { setIsSavingOrder(false); }
  };

  const onDragStart = (idx: number) => { dragIndex.current = idx; };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === idx) return;
    setSortDraft(d => {
      const arr = [...d]; const [moved] = arr.splice(dragIndex.current!, 1);
      arr.splice(idx, 0, moved); dragIndex.current = idx; return arr;
    });
  };

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string, count?: number) => (
    <button onClick={() => { setTab(t); setSearchTerm(''); }}
      className={`flex flex-col items-center gap-1 py-3 px-3 rounded-2xl font-black text-xs transition-all flex-1 ${tab === t ? 'bg-[#76151e] text-white shadow-lg' : 'bg-white/50 text-[#5a4a3f] hover:bg-white/80'}`}>
      <div className="flex items-center gap-1">{icon}
        {count !== undefined && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-white/30' : 'bg-[#76151e]/10 text-[#76151e]'}`}>{count}</span>}
      </div>
      <span>{label}</span>
    </button>
  );

  const empCard = (emp: Employee, mode: 'active' | 'resigned') => (
    <div key={emp.id} className={`bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-md flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-6 h-6 rounded-full bg-[#3a2a1f]/10 text-[#3a2a1f] flex items-center justify-center font-black text-xs shrink-0">{emp.sortOrder ?? '—'}</span>
        <div className={`w-10 h-10 rounded-full ${mode === 'resigned' ? 'bg-gray-400' : 'bg-[#76151e]'} text-white flex items-center justify-center font-bold text-base shrink-0`}>
          {emp.name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="font-black text-[#3a2a1f] truncate">{emp.name}</p>
          <p className="text-xs text-[#7a6a5f] font-bold">{emp.jobTitle || '—'}</p>
          {emp.branch && <p className="text-xs text-[#76151e] font-bold">{emp.branch}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => openEmpModal('view', emp)}
          className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:scale-110 transition-all"><Eye size={14}/></button>
        {canEdit && mode === 'active' && <>
          <button onClick={() => openEmpModal('edit', emp)}
            className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center hover:scale-110 transition-all"><Pencil size={14}/></button>
          {resignConfirmId === emp.id ? (
            <div className="flex items-center gap-1">
              <button onClick={() => openResignModal(emp)}
                className="text-[10px] bg-orange-500 text-white font-black px-2 py-1 rounded-lg hover:bg-orange-600 transition-all">تأكيد</button>
              <button onClick={() => setResignConfirmId(null)}
                className="text-[10px] bg-gray-200 text-gray-700 font-black px-2 py-1 rounded-lg hover:bg-gray-300 transition-all">إلغاء</button>
            </div>
          ) : (
            <button onClick={() => setResignConfirmId(emp.id)}
              className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-500 flex items-center justify-center hover:scale-110 transition-all" title="تحويل إلى مستقيل"><UserX size={14}/></button>
          )}
          <button onClick={() => setConfirmDelete({ open: true, id: emp.id, name: emp.name })}
            className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 text-red-400 flex items-center justify-center hover:scale-110 transition-all"><Trash2 size={14}/></button>
        </>}
        {canEdit && mode === 'resigned' && (
          <button onClick={() => reactivateEmployee(emp.id)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl transition-all">
            <UserCheck size={13}/>إعادة تعيين
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"/>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-5 rounded-full blur-3xl pointer-events-none"/>

      <div className="w-full flex items-center justify-between p-5 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-4 py-2 rounded-full shadow-sm transition-all">
          <ChevronLeft size={26}/><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-black text-[#3a2a1f]">قائمة الموظفين</h1>
        {canEdit && tab === 'active' ? (
          <button onClick={() => openEmpModal('add', {})}
            className="flex items-center gap-2 bg-[#76151e] text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-[#8a1923] transition-all text-sm">
            <UserPlus size={16}/>إضافة موظف
          </button>
        ) : <div className="w-32"/>}
      </div>

      <div className="px-5 mb-4 z-10 relative">
        <div className="flex gap-2">
          {tabBtn('active',   <span className="text-base">👥</span>, 'الموظفون النشطون', activeEmps.length)}
          {tabBtn('resigned', <span className="text-base">🚶</span>, 'المستقيلون',        resignedEmps.length)}
          {tabBtn('branches', <span className="text-base">🏢</span>, 'الفروع والوظائف')}
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 z-10 relative pb-12">

        {/* TAB: ACTIVE */}
        {tab === 'active' && (
          <div>
            {/* أزرار التصدير */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={exportPDF} disabled={!!isExporting || activeEmps.length === 0}
                className="flex items-center gap-1.5 bg-[#76151e] text-white font-black text-xs px-4 py-2 rounded-xl shadow hover:bg-[#8a1923] disabled:opacity-50 transition-all">
                {isExporting==='pdf' ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FileDown size={14}/>}
                PDF
              </button>
              <button onClick={exportExcel} disabled={!!isExporting || activeEmps.length === 0}
                className="flex items-center gap-1.5 bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow hover:bg-emerald-800 disabled:opacity-50 transition-all">
                {isExporting==='excel' ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FileSpreadsheet size={14}/>}
                Excel
              </button>
              <button onClick={handlePrint} disabled={!!isExporting || activeEmps.length === 0}
                className="flex items-center gap-1.5 bg-[#3a2a1f] text-white font-black text-xs px-4 py-2 rounded-xl shadow hover:bg-[#5a4a3f] disabled:opacity-50 transition-all">
                {isExporting==='print' ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Printer size={14}/>}
                طباعة
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a09080]"/>
                <input type="text" placeholder="بحث بالاسم أو الوظيفة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/70 border border-white/60 rounded-2xl pr-10 pl-4 py-2.5 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] placeholder:text-[#a09080]"/>
              </div>
              {branches.length > 0 && (
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                  className="bg-white/70 border border-white/60 rounded-2xl px-4 py-2.5 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] min-w-[140px]">
                  <option value="all">كل الفروع</option>
                  {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              )}
            </div>
            {loading ? <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-[#76151e] border-t-transparent rounded-full animate-spin"/></div>
              : filteredActive.length === 0 ? <div className="text-center py-16 text-[#a09080] font-bold">لا يوجد موظفون نشطون</div>
              : <div className="flex flex-col gap-3">{filteredActive.map(e => empCard(e, 'active'))}</div>}
          </div>
        )}

        {/* TAB: RESIGNED */}
        {tab === 'resigned' && (
          <div>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a09080]"/>
                <input type="text" placeholder="بحث في المستقيلين..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/70 border border-white/60 rounded-2xl pr-10 pl-4 py-2.5 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] placeholder:text-[#a09080]"/>
              </div>
              {branches.length > 0 && (
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                  className="bg-white/70 border border-white/60 rounded-2xl px-4 py-2.5 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] min-w-[140px]">
                  <option value="all">كل الفروع</option>
                  {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              )}
            </div>
            {filteredResigned.length === 0
              ? <div className="text-center py-16 text-[#a09080] font-bold">لا يوجد موظفون مستقيلون</div>
              : <div className="flex flex-col gap-3">{filteredResigned.map(e => empCard(e, 'resigned'))}</div>}
          </div>
        )}

        {/* TAB: BRANCHES */}
        {tab === 'branches' && (
          <div>
            <div className="flex gap-2 mb-5 flex-wrap">
              {canEdit && <>
                <button onClick={() => setBranchModal(true)} className="flex items-center gap-2 bg-[#76151e] text-white px-4 py-2.5 rounded-2xl font-bold shadow-md hover:bg-[#8a1923] transition-all text-sm"><Plus size={15}/>إضافة فرع</button>
                <button onClick={() => setJobModal(true)} className="flex items-center gap-2 bg-[#3a2a1f] text-white px-4 py-2.5 rounded-2xl font-bold shadow-md hover:bg-[#5a4a3f] transition-all text-sm"><Briefcase size={15}/>إضافة وظيفة</button>
              </>}
              <button onClick={openSort} className="flex items-center gap-2 bg-white/70 border border-[#d4c4b7] text-[#3a2a1f] px-4 py-2.5 rounded-2xl font-bold hover:bg-white transition-all text-sm"><ListOrdered size={15}/>ترتيب الموظفين</button>
            </div>
            {branches.length === 0
              ? <div className="text-center py-16 text-[#a09080] font-bold">لا توجد فروع — أضف فرعاً جديداً</div>
              : <div className="flex flex-col gap-4">
                  {branches.map(br => (
                    <div key={br.id} className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 bg-[#3a2a1f]/5">
                        <div className="flex items-center gap-3">
                          <Building2 size={18} className="text-[#76151e]"/>
                          <span className="font-black text-[#3a2a1f]">{br.name}</span>
                          <span className="text-xs bg-[#76151e]/10 text-[#76151e] px-2 py-0.5 rounded-full font-bold">{br.jobs.length} وظيفة</span>
                        </div>
                        {canEdit && <button onClick={() => setDeleteBranchConfirm(br.id)} className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all"><Trash2 size={13}/></button>}
                      </div>
                      <div className="px-5 py-3 flex flex-wrap gap-2">
                        {br.jobs.length === 0 && <span className="text-xs text-[#c0b0a0] font-bold">لا توجد وظائف بعد</span>}
                        {br.jobs.map(job => (
                          <span key={job} className="group flex items-center gap-1.5 bg-white border border-[#d4c4b7] rounded-xl px-3 py-1.5 text-sm font-bold text-[#5a4a3f]">
                            <Briefcase size={11} className="text-[#76151e]"/>{job}
                            {canEdit && <button onClick={() => setDeleteJobConfirm({ branchId: br.id, job })} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={11}/></button>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>}
          </div>
        )}
      </main>
      <Footer/>

      {/* ═══ SORT PANEL ═══ */}
      {showSort && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-[#3a2a1f] text-white rounded-t-3xl shrink-0">
              <div>
                <p className="font-black flex items-center gap-2"><ListOrdered size={18}/>ترتيب الموظفين</p>
                <p className="text-white/60 text-xs font-bold">اسحب أو استخدم الأسهم</p>
              </div>
              <button onClick={() => setShowSort(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X size={18}/></button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
              {sortDraft.map((item, idx) => (
                <div key={item.id} draggable onDragStart={() => onDragStart(idx)} onDragOver={e => onDragOver(e, idx)}
                  className="flex items-center gap-3 bg-white/80 rounded-2xl px-4 py-3 border border-[#d4c4b7] shadow-sm cursor-grab active:cursor-grabbing active:opacity-60 select-none">
                  <GripVertical size={16} className="text-[#c0b0a0] shrink-0"/>
                  <span className="w-7 h-7 rounded-full bg-[#76151e] text-white flex items-center justify-center font-black text-xs shrink-0">{idx+1}</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#76151e]/20 text-[#76151e] flex items-center justify-center font-black text-sm shrink-0">{item.name?.charAt(0) ?? '?'}</div>
                    <div className="min-w-0">
                      <p className="font-black text-[#3a2a1f] truncate text-sm">{item.name}</p>
                      <p className="text-xs text-[#7a6a5f] truncate">{item.jobTitle}{item.branch ? ` · ${item.branch}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveSort(idx, 'up')} disabled={idx===0} className="w-6 h-6 rounded-lg bg-[#e6dfd3] hover:bg-[#76151e] hover:text-white text-[#5a4a3f] flex items-center justify-center disabled:opacity-30 transition-all"><ChevronUp size={13}/></button>
                    <button onClick={() => moveSort(idx, 'down')} disabled={idx===sortDraft.length-1} className="w-6 h-6 rounded-lg bg-[#e6dfd3] hover:bg-[#76151e] hover:text-white text-[#5a4a3f] flex items-center justify-center disabled:opacity-30 transition-all"><ChevronDown size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#d6cfc3] bg-[#ece7df] rounded-b-3xl shrink-0 flex gap-3">
              <button onClick={saveOrder} disabled={isSavingOrder} className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] disabled:opacity-60 transition-all">
                {isSavingOrder ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save size={16}/>}حفظ الترتيب
              </button>
              <button onClick={() => setShowSort(false)} className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EMPLOYEE MODAL ═══ */}
      {empModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEmpModal(p=>({...p,open:false}))}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 bg-[#76151e] text-white rounded-t-3xl shrink-0">
              <p className="font-black">{empModal.mode==='add'?'إضافة موظف جديد':empModal.mode==='edit'?'تعديل بيانات الموظف':'بيانات الموظف'}</p>
              <button onClick={() => setEmpModal(p=>({...p,open:false}))} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X size={18}/></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
              {[
                { key: 'name', label: 'اسم الموظف *', placeholder: 'أدخل اسم الموظف' },
                { key: 'fingerprintName', label: 'اسم البصمة', placeholder: 'كما يظهر في ملف البصمة' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">{label}</label>
                  {empModal.mode === 'view'
                    ? <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{(empModal.emp as any)[key] || '—'}</div>
                    : <input type="text" value={(empModal.emp as any)[key] || ''} onChange={e => setEmpModal(p=>({...p,emp:{...p.emp,[key]:e.target.value}}))}
                        placeholder={placeholder} className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]"/>}
                </div>
              ))}
              {/* Branch */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">الفرع</label>
                {empModal.mode === 'view'
                  ? <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{empModal.emp.branch || '—'}</div>
                  : <select value={empModal.emp.branch || ''} onChange={e => {
                      setSelectedBranchForJob(e.target.value);
                      setEmpModal(p=>({...p, emp:{...p.emp, branch: e.target.value, jobTitle: ''}}));
                    }}
                    className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]">
                    <option value="">اختر الفرع</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>}
              </div>
              {/* Job — يعتمد على selectedBranchForJob المُحدَّثة فوراً */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">الوظيفة</label>
                {empModal.mode === 'view'
                  ? <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{empModal.emp.jobTitle || '—'}</div>
                  : selectedBranchForJob
                    ? (() => {
                        const jobs = branches.find(b => b.name === selectedBranchForJob)?.jobs || [];
                        return jobs.length > 0
                          ? <select value={empModal.emp.jobTitle || ''} onChange={e => setEmpModal(p=>({...p, emp:{...p.emp, jobTitle: e.target.value}}))}
                              className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]">
                              <option value="">اختر الوظيفة</option>
                              {jobs.map(j => <option key={j} value={j}>{j}</option>)}
                            </select>
                          : <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 font-bold text-sm">لا توجد وظائف مسجلة لهذا الفرع — أضف وظائف من تبويب الفروع والوظائف</div>;
                      })()
                    : <div className="bg-white/50 border border-[#d4c4b7] rounded-xl px-4 py-3 text-[#c0b0a0] font-bold text-sm">اختر الفرع أولاً لتظهر الوظائف المتاحة</div>}
              </div>
            </div>
            {empModal.mode !== 'view' && (
              <div className="px-6 py-4 border-t border-[#d6cfc3] bg-[#ece7df] rounded-b-3xl shrink-0 flex gap-3">
                <button onClick={saveEmployee} className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] transition-all">
                  <Save size={16}/>{empModal.mode==='add'?'إضافة':'حفظ التعديلات'}
                </button>
                <button onClick={() => setEmpModal(p=>({...p,open:false}))} className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">إلغاء</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ BRANCH MODAL ═══ */}
      {branchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBranchModal(false)}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <p className="font-black text-[#3a2a1f] text-lg mb-4 flex items-center gap-2"><Building2 size={20} className="text-[#76151e]"/>إضافة فرع جديد</p>
            <input type="text" value={newBranchName} onChange={e=>setNewBranchName(e.target.value)} placeholder="اسم الفرع" onKeyDown={e=>e.key==='Enter'&&addBranch()}
              className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] mb-4"/>
            <div className="flex gap-3">
              <button onClick={addBranch} className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black hover:bg-[#8a1923] transition-all">حفظ</button>
              <button onClick={() => { setBranchModal(false); setNewBranchName(''); }} className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ JOB MODAL ═══ */}
      {jobModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setJobModal(false)}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <p className="font-black text-[#3a2a1f] text-lg mb-4 flex items-center gap-2"><Briefcase size={20} className="text-[#76151e]"/>إضافة وظيفة جديدة</p>
            <select value={newJob.branchId} onChange={e=>setNewJob(j=>({...j,branchId:e.target.value}))}
              className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] mb-3">
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input type="text" value={newJob.title} onChange={e=>setNewJob(j=>({...j,title:e.target.value}))} placeholder="اسم الوظيفة" onKeyDown={e=>e.key==='Enter'&&addJob()}
              className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] mb-4"/>
            <div className="flex gap-3">
              <button onClick={addJob} className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black hover:bg-[#8a1923] transition-all">حفظ</button>
              <button onClick={() => { setJobModal(false); setNewJob({branchId:'',title:''}); }} className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={confirmDelete.open} title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف "${confirmDelete.name}"؟ لا يمكن التراجع.`}
        onConfirm={() => deleteEmployee(confirmDelete.id)} onCancel={() => setConfirmDelete({open:false,id:''})}/>

      {/* ═══ RESIGN MODAL ═══ */}
      {resignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isResigning && setResignModal(null)}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]" onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#3a2a1f] text-white rounded-t-3xl shrink-0">
              <div>
                <p className="font-black flex items-center gap-2"><UserX size={18}/>تحويل إلى مستقيل</p>
                <p className="text-white/60 text-xs font-bold mt-0.5">{resignModal.name}</p>
              </div>
              <button onClick={() => !isResigning && setResignModal(null)} disabled={isResigning}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"><X size={18}/></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
              {resignErr && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-red-700 font-bold text-sm">
                  <AlertCircle size={15} className="shrink-0 mt-0.5"/>{resignErr}
                </div>
              )}

              {/* Resignation Date */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">تاريخ الاستقالة *</label>
                <input type="date" value={resignDate} onChange={e=>setResignDate(e.target.value)} disabled={isResigning}
                  className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] disabled:opacity-60"/>
              </div>

              {/* 3 File Uploads */}
              {([
                { key: 'letter',    label: 'استقالة',           icon: '📝', required: false },
                { key: 'clearance', label: 'إقرار مخالصة',     icon: '📄', required: false },
                { key: 'acquittal', label: 'إقرار تبرئة ذمة',  icon: '📋', required: false },
              ] as const).map(ft => (
                <div key={ft.key}>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">
                    {ft.icon} {ft.label}
                  </label>
                  <div onClick={() => !isResigning && resignFileRefs[ft.key].current?.click()}
                    className={`w-full border-2 border-dashed rounded-xl p-3 flex items-center gap-3 transition-all ${resignFiles[ft.key] ? 'border-emerald-300 bg-emerald-50/50' : 'border-[#d4c4b7] bg-white/50 hover:border-[#76151e]/40 cursor-pointer'} ${isResigning?'opacity-60 cursor-not-allowed':''}`}>
                    {resignFiles[ft.key] ? (
                      <>
                        <CheckCircle size={18} className="text-emerald-600 shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#3a2a1f] text-sm truncate">{resignFiles[ft.key]!.name}</p>
                          {isResigning && resignProgress[ft.key] > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-[#e0d8cc] rounded-full h-1.5">
                                <div className="bg-[#76151e] h-1.5 rounded-full transition-all" style={{width:`${resignProgress[ft.key]}%`}}/>
                              </div>
                              <p className="text-[10px] text-[#76151e] font-bold mt-0.5">{resignProgress[ft.key]}%</p>
                            </div>
                          )}
                        </div>
                        {!isResigning && (
                          <button onClick={e=>{e.stopPropagation(); setResignFiles(p=>({...p,[ft.key]:null}));}} className="w-6 h-6 rounded-full bg-red-100 text-red-400 flex items-center justify-center shrink-0"><X size={11}/></button>
                        )}
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="text-[#a09080] shrink-0"/>
                        <p className="text-sm text-[#a09080] font-bold">اضغط لرفع {ft.label}</p>
                      </>
                    )}
                  </div>
                  <input ref={resignFileRefs[ft.key]} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden" disabled={isResigning}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setResignFiles(p=>({...p,[ft.key]:f})); }}/>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#d6cfc3] bg-[#ece7df] rounded-b-3xl shrink-0 flex gap-3">
              <button onClick={resignEmployee} disabled={isResigning || !resignDate}
                className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] disabled:opacity-50 transition-all">
                {isResigning ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>جاري الحفظ...</> : <><UserX size={16}/>تأكيد الاستقالة</>}
              </button>
              <button onClick={() => setResignModal(null)} disabled={isResigning}
                className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white disabled:opacity-50 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}      {deleteBranchConfirm && (
        <ConfirmModal open={true} title="حذف الفرع"
          message={`هل تريد حذف "${branches.find(b=>b.id===deleteBranchConfirm)?.name}"؟`}
          onConfirm={() => deleteBranch(deleteBranchConfirm)} onCancel={() => setDeleteBranchConfirm(null)}/>
      )}
      {deleteJobConfirm && (
        <ConfirmModal open={true} title="حذف الوظيفة"
          message={`هل تريد حذف وظيفة "${deleteJobConfirm.job}"؟`}
          onConfirm={() => deleteJob(deleteJobConfirm.branchId, deleteJobConfirm.job)} onCancel={() => setDeleteJobConfirm(null)}/>
      )}
    </div>
  );
}
