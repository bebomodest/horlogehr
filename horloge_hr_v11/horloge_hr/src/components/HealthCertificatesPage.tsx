import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Eye, Pencil, Shield, Save, X, AlertTriangle, CheckCircle, Clock, Search, Upload, User, FileImage, Download, FileDown, Printer, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Footer } from './Footer';
import { db } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { logActivity } from './NotificationsPage';
import { differenceInDays, parseISO, format } from 'date-fns';

// ضغط الصورة وتحويلها إلى base64 (أقصى حجم 800px، جودة 70%)
const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface Employee {
  id: string;
  name: string;
  jobTitle: string;
  branch?: string;
  status?: string;
}

interface HealthCertificate {
  employeeName: string;
  jobTitle: string;
  hasCertificate: boolean;
  certificateNumber: string;
  expiryDate: string;
  notes: string;
  employeePhotoUrl?: string;
  certPhotoUrl?: string;
}

type ModalMode = 'view' | 'edit' | null;

const getDaysRemaining = (expiryDate: string): number | null => {
  if (!expiryDate) return null;
  try { return differenceInDays(parseISO(expiryDate), new Date()); }
  catch { return null; }
};

const DaysChip = ({ days }: { days: number | null }) => {
  if (days === null) return <span className="text-[#a09080] font-bold text-sm">لم تُحدد</span>;
  if (days < 0)   return <span className="inline-flex items-center gap-1 bg-black text-white font-black text-xs px-2.5 py-1 rounded-full"><AlertTriangle size={11}/>منتهية منذ {Math.abs(days)} يوم</span>;
  if (days === 0) return <span className="inline-flex items-center gap-1 bg-red-200 text-red-800 font-black text-xs px-2.5 py-1 rounded-full"><AlertTriangle size={11}/>تنتهي اليوم!</span>;
  if (days <= 30) return <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 font-black text-xs px-2.5 py-1 rounded-full"><Clock size={11}/>{days} يوم</span>;
  return <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-full"><CheckCircle size={11}/>{days} يوم</span>;
};

const PhotoUploadBox = ({
  label, icon, preview, onFileChange, readonly, downloadName
}: {
  label: string; icon: React.ReactNode; preview: string;
  onFileChange?: (file: File) => void; readonly?: boolean; downloadName?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDownload = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview;
    a.download = downloadName || 'صورة.jpg';
    a.click();
  };

  return (
    <div>
      <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">{label}</label>
      {preview ? (
        <div className="relative group">
          <img src={preview} alt={label} className="w-full h-40 object-cover rounded-xl border-2 border-[#d4c4b7]" />
          {readonly ? (
            <button onClick={handleDownload}
              className="absolute bottom-2 left-2 bg-black/60 hover:bg-black/80 text-white text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all opacity-0 group-hover:opacity-100">
              <Download size={13} />تنزيل
            </button>
          ) : (
            <button onClick={() => inputRef.current?.click()}
              className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white font-black gap-2">
              <Upload size={18} />تغيير الصورة
            </button>
          )}
        </div>
      ) : readonly ? (
        <div className="w-full h-32 rounded-xl border-2 border-dashed border-[#d4c4b7] bg-white/50 flex flex-col items-center justify-center text-[#c0b0a0] gap-2">
          {icon}<span className="text-xs font-bold">لا توجد صورة</span>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()}
          className="w-full h-32 rounded-xl border-2 border-dashed border-[#76151e]/30 bg-white/50 hover:bg-[#76151e]/5 flex flex-col items-center justify-center text-[#76151e]/60 hover:text-[#76151e] gap-2 cursor-pointer transition-all">
          <Upload size={22} /><span className="text-xs font-bold">اضغط لرفع الصورة</span>
        </div>
      )}
      {!readonly && (
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f && onFileChange) onFileChange(f); }} />
      )}
    </div>
  );
};

export default function HealthCertificatesPage({ onBack }: { onBack: () => void }) {
  const instance = getFirebaseInstance('hr');
  const dbToUse = instance?.db || db;

  // بيانات المستخدم الحالي للتصدير
  const [currentUser] = useState<{ name: string; jobTitle: string } | null>(() => {
    try { const s = sessionStorage.getItem('hr_user'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  const [isExporting, setIsExporting] = useState<'pdf'|'excel'|'print'|null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [certificates, setCertificates] = useState<Record<string, HealthCertificate>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ hasCertificate: true, certificateNumber: '', expiryDate: '', notes: '', employeePhotoUrl: '', certPhotoUrl: '' });
  const [empPhotoFile, setEmpPhotoFile] = useState<File | null>(null);
  const [certPhotoFile, setCertPhotoFile] = useState<File | null>(null);
  const [empPhotoPreview, setEmpPhotoPreview] = useState('');
  const [certPhotoPreview, setCertPhotoPreview] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const empSnap = await getDocs(collection(dbToUse, 'employees'));
        const emps: Employee[] = empSnap.docs
          .map(d => ({ id: d.id, name: d.data().name || '', jobTitle: d.data().jobTitle || '', branch: d.data().branch || '', status: d.data().status, sortOrder: d.data().sortOrder ?? 9999 }))
          .filter(e => e.name && e.status !== 'resigned')
          .sort((a, b) => {
            const ao = (a as any).sortOrder ?? 9999;
            const bo = (b as any).sortOrder ?? 9999;
            if (ao !== bo) return ao - bo;
            return a.name.localeCompare(b.name, 'ar');
          });
        setEmployees(emps);

        const certSnap = await getDocs(collection(dbToUse, 'health_certificates'));
        const certsMap: Record<string, HealthCertificate> = {};
        certSnap.docs.forEach(d => { certsMap[d.id] = d.data() as HealthCertificate; });
        setCertificates(certsMap);

        // تحميل الفروع للفلتر
        const branchSnap = await getDocs(collection(dbToUse, 'branches'));
        const branchNames = branchSnap.docs.map(d => d.data().name as string).filter(Boolean);
        setBranches(branchNames);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [dbToUse]);

  const handlePhotoSelect = (file: File, type: 'emp' | 'cert') => {
    const url = URL.createObjectURL(file);
    if (type === 'emp') { setEmpPhotoFile(file); setEmpPhotoPreview(url); }
    else { setCertPhotoFile(file); setCertPhotoPreview(url); }
  };

  const openModal = (emp: Employee, mode: ModalMode) => {
    setSelectedEmp(emp);
    setModalMode(mode);
    setSaveSuccess(false);
    setSaveError('');
    setEmpPhotoFile(null); setCertPhotoFile(null);
    const cert = (certificates[emp.id] || {}) as HealthCertificate;
    setEditForm({
      hasCertificate: cert.hasCertificate !== false,  // default true لو مش موجود
      certificateNumber: cert.certificateNumber || '',
      expiryDate: cert.expiryDate || '',
      notes: cert.notes || '',
      employeePhotoUrl: cert.employeePhotoUrl || '',
      certPhotoUrl: cert.certPhotoUrl || '',
    });
    setEmpPhotoPreview(cert.employeePhotoUrl || '');
    setCertPhotoPreview(cert.certPhotoUrl || '');
  };

  const closeModal = () => {
    setModalMode(null); setSelectedEmp(null); setSaveSuccess(false);
    setEmpPhotoFile(null); setCertPhotoFile(null);
    setEmpPhotoPreview(''); setCertPhotoPreview('');
  };

  // ─── بناء بيانات التصدير ──────────────────────────────────────────────────
  const buildExportData = () => {
    const headers = ['#', 'اسم الموظف', 'الوظيفة', 'رقم الشهادة', 'تاريخ الانتهاء', 'الأيام المتبقية', 'الحالة'];
    const rows = employees.map((emp, idx) => {
      const cert = certificates[emp.id];
      const days = getDaysRemaining(cert?.expiryDate);
      const statusText = days === null ? 'لا توجد بيانات'
        : days < 0  ? `منتهية منذ ${Math.abs(days)} يوم`
        : days === 0 ? 'تنتهي اليوم'
        : days <= 30 ? `${days} يوم — قريبة الانتهاء`
        : `${days} يوم — سارية`;
      return [
        idx + 1,
        emp.name,
        emp.jobTitle || '-',
        cert?.certificateNumber || 'لم يُضف',
        cert?.expiryDate || 'لم تُحدد',
        days === null ? '-' : `${days < 0 ? 'منتهية' : days + ' يوم'}`,
        statusText,
      ];
    });
    const expired  = employees.filter(e => { const d = getDaysRemaining(certificates[e.id]?.expiryDate); return d !== null && d < 0; }).length;
    const soon     = employees.filter(e => { const d = getDaysRemaining(certificates[e.id]?.expiryDate); return d !== null && d >= 0 && d <= 30; }).length;
    const valid    = employees.filter(e => { const d = getDaysRemaining(certificates[e.id]?.expiryDate); return d !== null && d > 30; }).length;
    const noCert   = employees.filter(e => !certificates[e.id]?.expiryDate).length;
    const statsRows = [
      { label: 'إجمالي الموظفين',       value: String(employees.length) },
      { label: 'شهادات سارية',           value: String(valid) },
      { label: 'تنتهي خلال 30 يوم',     value: String(soon) },
      { label: 'شهادات منتهية',          value: String(expired) },
      { label: 'بدون بيانات شهادة',     value: String(noCert) },
    ];
    const subtitle = `تقرير الشهادات الصحية — ${format(new Date(), 'yyyy-MM-dd')}`;
    return { headers, rows, statsRows, subtitle };
  };

  const exportPDF = async () => {
    setIsExporting('pdf');
    try {
      const { buildReportHTML, exportAsPDF } = await import('../lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      const html = await buildReportHTML(
        'الشهادات الصحية', subtitle,
        currentUser?.name || 'النظام', currentUser?.jobTitle || 'مسؤول الموارد البشرية',
        headers, rows, statsRows, 'landscape'
      );
      exportAsPDF(html, 'الشهادات-الصحية.pdf');
    } finally { setIsExporting(null); }
  };

  const exportExcel = async () => {
    setIsExporting('excel');
    try {
      const ExcelJS = await import('exceljs');
      const { exportAsExcel } = await import('../lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      await exportAsExcel(
        ExcelJS, 'الشهادات الصحية', subtitle,
        currentUser?.name || 'النظام', currentUser?.jobTitle || 'مسؤول الموارد البشرية',
        headers, rows, statsRows, 'الشهادات-الصحية.xlsx'
      );
    } finally { setIsExporting(null); }
  };

  const handlePrint = async () => {
    setIsExporting('print');
    try {
      const { buildReportHTML, exportAsPDF } = await import('../lib/exportTemplate');
      const { headers, rows, statsRows, subtitle } = buildExportData();
      const html = await buildReportHTML(
        'الشهادات الصحية', subtitle,
        currentUser?.name || 'النظام', currentUser?.jobTitle || 'مسؤول الموارد البشرية',
        headers, rows, statsRows, 'landscape'
      );
      exportAsPDF(html, '', true);
    } finally { setIsExporting(null); }
  };

  const handleDelete = async (empId: string) => {
    const empName = employees.find(e => e.id === empId)?.name || 'موظف';
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'health_certificates', empId));
      const userName = currentUser?.name || 'النظام';
      logActivity(db, 'حذف شهادة صحية', `تم حذف بيانات الشهادة الصحية للموظف: ${empName}`, userName, 'health_certificate');
    } catch {}
    setCertificates(prev => { const n = { ...prev }; delete n[empId]; return n; });
    setDeleteConfirmId(null);
  };

  const handleSave = async () => {
    if (!selectedEmp) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const certData: HealthCertificate = {
        employeeName: selectedEmp.name,
        jobTitle: selectedEmp.jobTitle,
        hasCertificate: editForm.hasCertificate,
        certificateNumber: editForm.hasCertificate ? editForm.certificateNumber : '',
        expiryDate: editForm.hasCertificate ? editForm.expiryDate : '',
        notes: editForm.hasCertificate ? editForm.notes : '',
        employeePhotoUrl: editForm.hasCertificate ? (editForm.employeePhotoUrl || '') : '',
        certPhotoUrl: editForm.hasCertificate ? (editForm.certPhotoUrl || '') : '',
      };

      // تحويل الصور إلى base64 مضغوطة وتخزينها في Firestore مباشرة
      if (empPhotoFile) {
        try { certData.employeePhotoUrl = await compressImageToBase64(empPhotoFile); }
        catch (e) { console.warn('خطأ في ضغط صورة الموظف:', e); }
      }
      if (certPhotoFile) {
        try { certData.certPhotoUrl = await compressImageToBase64(certPhotoFile); }
        catch (e) { console.warn('خطأ في ضغط صورة الشهادة:', e); }
      }

      await setDoc(doc(db, 'health_certificates', selectedEmp.id), certData);
      setCertificates(prev => ({ ...prev, [selectedEmp.id]: certData }));

      // تسجيل النشاط في الإشعارات
      const userName = currentUser?.name || 'النظام';
      const isNew = !certificates[selectedEmp.id];
      const action = isNew ? 'إضافة شهادة صحية' : 'تعديل شهادة صحية';
      const certStatus = !certData.hasCertificate
        ? 'تسجيل: ليس لديه شهادة'
        : certData.expiryDate
        ? `رقم: ${certData.certificateNumber || 'غير محدد'} — ينتهي: ${certData.expiryDate}`
        : 'بيانات جزئية';
      logActivity(db, action, `${selectedEmp.name} — ${certStatus}`, userName, 'health_certificate');

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: any) {
      setSaveError(e?.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = employees.filter(e =>
    (e.name.includes(searchQuery) || e.jobTitle.includes(searchQuery)) &&
    (branchFilter === 'all' || (e as any).branch === branchFilter)
  );

  const totalWithCert = employees.filter(e => certificates[e.id]?.expiryDate).length;
  const expiredCount = employees.filter(e => { const d = getDaysRemaining(certificates[e.id]?.expiryDate); return d !== null && d < 0; }).length;
  const soonCount = employees.filter(e => { const d = getDaysRemaining(certificates[e.id]?.expiryDate); return d !== null && d >= 0 && d <= 60; }).length;

  const selectedCert = selectedEmp ? (certificates[selectedEmp.id] || null) : null;

  // ألوان الصفوف
  const getRowBg = (days: number | null, cert?: HealthCertificate) => {
    if (cert?.hasCertificate === false) return 'bg-emerald-50/90'; // ليس له شهادة — أخضر
    if (days === null) return '';
    if (days < 0)   return 'bg-gray-900 text-white';   // منتهية — أسود
    if (days <= 30) return 'bg-red-100/80';             // ≤30 يوم — أحمر
    return 'bg-emerald-50/90';                          // >30 يوم — أخضر
  };

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-black text-[#3a2a1f] flex items-center gap-2">
          <Shield size={26} className="text-[#76151e]" />الشهادات الصحية
        </h1>
        <div className="w-24" />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 z-10 relative pb-12">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm text-center">
            <p className="text-xs font-bold text-[#7a6a5f] mb-1">إجمالي الموظفين</p>
            <p className="text-3xl font-black text-[#3a2a1f]">{employees.length}</p>
          </div>
          <div className="bg-emerald-50/80 backdrop-blur-md rounded-2xl p-4 border border-emerald-200 shadow-sm text-center">
            <p className="text-xs font-bold text-emerald-700 mb-1">لديهم شهادة</p>
            <p className="text-3xl font-black text-emerald-600">{totalWithCert}</p>
          </div>
          <div className="bg-red-50/80 backdrop-blur-md rounded-2xl p-4 border border-red-200 shadow-sm text-center">
            <p className="text-xs font-bold text-red-700 mb-1">منتهية / تنتهي قريباً</p>
            <p className="text-3xl font-black text-red-600">{expiredCount + soonCount}</p>
          </div>
        </div>

        {/* أزرار التصدير */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button onClick={exportPDF} disabled={!!isExporting || loading || employees.length === 0}
            className="flex items-center gap-2 bg-[#76151e] hover:bg-[#8a1923] disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-2xl shadow-md hover:shadow-lg transition-all text-sm">
            {isExporting === 'pdf'
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : <FileDown size={17}/>}
            تصدير PDF
          </button>
          <button onClick={exportExcel} disabled={!!isExporting || loading || employees.length === 0}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-2xl shadow-md hover:shadow-lg transition-all text-sm">
            {isExporting === 'excel'
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : <FileSpreadsheet size={17}/>}
            تصدير Excel
          </button>
          <button onClick={handlePrint} disabled={!!isExporting || loading || employees.length === 0}
            className="flex items-center gap-2 bg-[#3a2a1f] hover:bg-[#4a3a2f] disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-2xl shadow-md hover:shadow-lg transition-all text-sm">
            {isExporting === 'print'
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : <Printer size={17}/>}
            طباعة
          </button>
          <span className="text-xs text-[#a09080] font-bold me-auto">{employees.length} موظف</span>
        </div>

        {/* دليل الألوان */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <span className="text-xs font-bold text-[#7a6a5f]">دليل الألوان:</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700"><span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 inline-block"/>أكثر من 30 يوم / ليس له شهادة</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block"/>30 يوم أو أقل</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-800"><span className="w-3 h-3 rounded-sm bg-gray-900 inline-block"/>منتهية</span>
        </div>

        {/* Search + Branch Filter */}
        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a09080]" />
            <input type="text" placeholder="ابحث بالاسم أو الوظيفة..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/70 border border-white/60 rounded-2xl pr-11 pl-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] placeholder:text-[#a09080] backdrop-blur-md" />
          </div>
          {branches.length > 0 && (
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="bg-white/70 border border-white/60 rounded-2xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] min-w-[150px] backdrop-blur-md">
              <option value="all">كل الفروع</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-4 border-[#76151e] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#76151e] text-white">
                  <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">#</th>
                  <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">اسم الموظف</th>
                  <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">الوظيفة</th>
                  <th className="px-4 py-3.5 text-center font-black whitespace-nowrap">رقم الشهادة</th>
                  <th className="px-4 py-3.5 text-center font-black whitespace-nowrap">تاريخ الانتهاء</th>
                  <th className="px-4 py-3.5 text-center font-black whitespace-nowrap">الأيام المتبقية</th>
                  <th className="px-4 py-3.5 text-center font-black whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-14 text-[#a09080] font-bold text-base">
                    {searchQuery ? 'لا توجد نتائج للبحث' : 'لا يوجد موظفون مسجلون'}
                  </td></tr>
                ) : filtered.map((emp, idx) => {
                  const cert = certificates[emp.id];
                  const days = getDaysRemaining(cert?.expiryDate);
                  const noCert = cert?.hasCertificate === false;
                  const rowBg = getRowBg(days, cert);

                  return (
                    <tr key={emp.id} className={`${rowBg} border-b border-[#e6dfd3]/60 last:border-0 hover:brightness-[0.97] transition-all`}>
                      <td className="px-4 py-3.5 font-black text-[#a09080] text-sm">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {cert?.employeePhotoUrl ? (
                            <img src={cert.employeePhotoUrl} alt={emp.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#76151e]/10 text-[#76151e] flex items-center justify-center font-black text-sm shrink-0">
                              {emp.name?.charAt(0) ?? '?'}
                            </div>
                          )}
                          <span className="font-black text-[#3a2a1f]">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-[#5a4a3f]">{emp.jobTitle || '-'}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-[#3a2a1f]">
                        {noCert
                          ? <span className="text-emerald-700 font-black text-xs bg-emerald-100 px-2 py-0.5 rounded-lg">ليس له شهادة</span>
                          : cert?.certificateNumber
                          ? <span className="bg-white/80 border border-[#d4c4b7] rounded-lg px-2.5 py-0.5">{cert.certificateNumber}</span>
                          : <span className="text-[#c0b0a0] font-bold">لم يُضف</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold">
                        {noCert ? <span className="text-emerald-600 font-bold">—</span>
                          : cert?.expiryDate
                          ? <span className={(days !== null && days < 0) ? 'text-white font-black' : (days !== null && days <= 30) ? 'text-red-600 font-black' : 'text-[#3a2a1f]'}>{cert.expiryDate}</span>
                          : <span className="text-[#c0b0a0] font-bold">لم تُحدد</span>}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {noCert
                          ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-black text-xs px-2.5 py-1 rounded-full"><CheckCircle size={11}/>ليس له شهادة</span>
                          : <DaysChip days={days} />}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openModal(emp, 'view')}
                            className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center transition-all hover:scale-110 hover:shadow-md" title="عرض البيانات">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => openModal(emp, 'edit')}
                            className="w-8 h-8 rounded-xl bg-[#76151e]/10 hover:bg-[#76151e]/20 border border-[#76151e]/20 text-[#76151e] flex items-center justify-center transition-all hover:scale-110 hover:shadow-md" title="تعديل البيانات">
                            <Pencil size={15} />
                          </button>
                          {certificates[emp.id] && (
                            deleteConfirmId === emp.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => handleDelete(emp.id)}
                                  className="text-[10px] bg-red-600 text-white font-black px-2 py-1 rounded-lg hover:bg-red-700 transition-all">
                                  تأكيد
                                </button>
                                <button onClick={() => setDeleteConfirmId(null)}
                                  className="text-[10px] bg-gray-200 text-gray-700 font-black px-2 py-1 rounded-lg hover:bg-gray-300 transition-all">
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(emp.id)}
                                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all hover:scale-110 hover:shadow-md" title="مسح بيانات الشهادة">
                                <Trash2 size={14} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />

      {/* ─── Modal ─── */}
      {modalMode && selectedEmp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-lg border border-white/60 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#76151e] text-white shrink-0">
              <div className="flex items-center gap-3">
                {(empPhotoPreview || selectedCert?.employeePhotoUrl) ? (
                  <img src={empPhotoPreview || selectedCert?.employeePhotoUrl} alt={selectedEmp.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-white/40 shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center font-black text-lg shrink-0">
                    {selectedEmp.name?.charAt(0) ?? '?'}
                  </div>
                )}
                <div>
                  <p className="font-black text-base leading-tight">{selectedEmp.name}</p>
                  <p className="text-white/70 text-xs font-bold">{selectedEmp.jobTitle}</p>
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="flex items-center gap-2 mb-5">
                {modalMode === 'view'
                  ? <><Eye size={18} className="text-blue-600" /><h3 className="font-black text-[#3a2a1f]">بيانات الشهادة الصحية</h3></>
                  : <><Pencil size={18} className="text-[#76151e]" /><h3 className="font-black text-[#3a2a1f]">تعديل الشهادة الصحية</h3></>}
              </div>

              <div className="flex flex-col gap-5">

                {/* ── اختيار وجود شهادة ── */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-2 uppercase tracking-wide">حالة الشهادة الصحية</label>
                  {modalMode === 'view' ? (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm ${selectedCert?.hasCertificate !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedCert?.hasCertificate !== false ? <CheckCircle size={16}/> : <X size={16}/>}
                      {selectedCert?.hasCertificate !== false ? 'له شهادة صحية' : 'ليس له شهادة'}
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => setEditForm(f => ({ ...f, hasCertificate: true }))}
                        className={`flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${editForm.hasCertificate ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-[#d4c4b7] hover:border-emerald-300'}`}>
                        <CheckCircle size={16}/>له شهادة
                      </button>
                      <button onClick={() => setEditForm(f => ({ ...f, hasCertificate: false }))}
                        className={`flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all ${!editForm.hasCertificate ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-[#d4c4b7] hover:border-gray-400'}`}>
                        <X size={16}/>ليس له شهادة
                      </button>
                    </div>
                  )}
                </div>

                {/* ── الحقول التفصيلية: تظهر فقط لو له شهادة ── */}
                {(modalMode === 'view' ? selectedCert?.hasCertificate !== false : editForm.hasCertificate) && (
                  <>
                {/* Photos row */}
                <div className="grid grid-cols-2 gap-4">
                  <PhotoUploadBox
                    label="صورة الموظف"
                    icon={<User size={28} className="text-[#c0b0a0]" />}
                    preview={empPhotoPreview}
                    onFileChange={f => handlePhotoSelect(f, 'emp')}
                    readonly={modalMode === 'view'}
                    downloadName={`صورة-الموظف-${selectedEmp?.name}.jpg`}
                  />
                  <PhotoUploadBox
                    label="صورة الشهادة"
                    icon={<FileImage size={28} className="text-[#c0b0a0]" />}
                    preview={certPhotoPreview}
                    onFileChange={f => handlePhotoSelect(f, 'cert')}
                    readonly={modalMode === 'view'}
                    downloadName={`شهادة-${selectedEmp?.name}.jpg`}
                  />
                </div>

                {/* Employee Name */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">اسم الموظف</label>
                  <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{selectedEmp.name}</div>
                </div>

                {/* Job Title */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">الوظيفة</label>
                  <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">{selectedEmp.jobTitle || '-'}</div>
                </div>

                {/* Certificate Number */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">رقم الشهادة</label>
                  {modalMode === 'view' ? (
                    <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-mono font-bold text-[#3a2a1f]">
                      {selectedCert?.certificateNumber || <span className="text-[#c0b0a0]">لم يُضف بعد</span>}
                    </div>
                  ) : (
                    <input type="text" value={editForm.certificateNumber}
                      onChange={e => setEditForm(f => ({ ...f, certificateNumber: e.target.value }))}
                      placeholder="أدخل رقم الشهادة..."
                      className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-mono font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] placeholder:text-[#c0b0a0]" />
                  )}
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">تاريخ انتهاء الشهادة</label>
                  {modalMode === 'view' ? (
                    <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f]">
                      {selectedCert?.expiryDate ? (
                        <div className="flex items-center justify-between">
                          <span>{selectedCert.expiryDate}</span>
                          <DaysChip days={getDaysRemaining(selectedCert.expiryDate)} />
                        </div>
                      ) : <span className="text-[#c0b0a0]">لم تُحدد بعد</span>}
                    </div>
                  ) : (
                    <input type="date" value={editForm.expiryDate}
                      onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]" />
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">ملاحظات</label>
                  {modalMode === 'view' ? (
                    <div className="bg-white/70 border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] min-h-[60px]">
                      {selectedCert?.notes || <span className="text-[#c0b0a0]">لا توجد ملاحظات</span>}
                    </div>
                  ) : (
                    <textarea value={editForm.notes}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="ملاحظات إضافية..." rows={3}
                      className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] resize-none placeholder:text-[#c0b0a0]" />
                  )}
                </div>
                  </>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 flex flex-col gap-3 border-t border-[#d6cfc3] bg-[#ece7df] shrink-0">
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-700 font-bold text-sm flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />{saveError}
                </div>
              )}
              <div className="flex gap-3">
              {modalMode === 'view' ? (
                <>
                  <button onClick={() => setModalMode('edit')}
                    className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] transition-all">
                    <Pencil size={16} />تعديل
                  </button>
                  <button onClick={closeModal}
                    className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">
                    إغلاق
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleSave} disabled={isSaving}
                    className={`flex-1 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-[#76151e] text-white hover:bg-[#8a1923]'}`}>
                    {isSaving
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : saveSuccess ? <><CheckCircle size={16} />تم الحفظ!</>
                      : <><Save size={16} />حفظ</>}
                  </button>
                  <button onClick={closeModal}
                    className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">
                    إلغاء
                  </button>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
