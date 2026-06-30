import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Plus, Trash2, Download, FileText, FileSpreadsheet,
  Image, File, Upload, X, Save, Clock, HardDrive, Construction,
  AlertCircle, Printer, ChevronRight, User, Users,
} from 'lucide-react';
import { Footer } from './Footer';
import { db, storage } from '../firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseInstance } from '../lib/databaseManager';

const safeFmtDate = (ts: any): string => {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toISOString().slice(0, 10);
  } catch { return '—'; }
};

type Tab = 'files' | 'templates';

interface HRFile {
  id: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
  storageUrl: string;
  storagePath: string;
  uploadedAt: any;
  uploadedBy: string;
}

interface Employee {
  id: string;
  name: string;
  jobTitle?: string;
  nationalId?: string;
  hireDate?: string;
  branch?: string;
  status?: string;
}

const ACCEPTED = '.xlsx,.xls,.doc,.docx,.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp';
const MAX_MB = 25;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getFileIcon = (type: string) => {
  if (type.includes('pdf'))   return <FileText size={22} className="text-red-500"/>;
  if (type.includes('word') || type.includes('doc')) return <FileText size={22} className="text-blue-500"/>;
  if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return <FileSpreadsheet size={22} className="text-emerald-600"/>;
  if (type.includes('image')) return <Image size={22} className="text-purple-500"/>;
  return <File size={22} className="text-gray-500"/>;
};

const getFileBadgeColor = (type: string) => {
  if (type.includes('pdf'))   return 'bg-red-100 text-red-700';
  if (type.includes('word') || type.includes('doc')) return 'bg-blue-100 text-blue-700';
  if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return 'bg-emerald-100 text-emerald-700';
  if (type.includes('image')) return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
};

const getTypeLabel = (type: string) => {
  if (type.includes('pdf'))   return 'PDF';
  if (type.includes('word') || type.includes('doc')) return 'Word';
  if (type.includes('sheet') || type.includes('excel') || type.includes('xls')) return 'Excel';
  if (type.includes('image')) return 'صورة';
  return 'ملف';
};

export default function HRDocumentsPage({ onBack }: { onBack: () => void }) {
  const instance = getFirebaseInstance('hr');
  const dbToUse = instance?.db || db;

  const currentUser = (() => {
    try { return JSON.parse(sessionStorage.getItem('hr_user') || '{}').name || 'النظام'; }
    catch { return 'النظام'; }
  })();

  const [tab, setTab] = useState<Tab>('files');
  const [files, setFiles] = useState<HRFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Work Receipt state
  const [workReceiptModal, setWorkReceiptModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [manualNationalId, setManualNationalId] = useState('');
  const [manualHireDate, setManualHireDate] = useState('');

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  const generateWorkReceiptHTML = () => {
    const emp = selectedEmp;
    if (!emp) return;
    const name      = emp.name;
    const nationalId = manualNationalId || emp.nationalId || '—';
    const jobTitle  = emp.jobTitle || '—';
    const hireDate  = manualHireDate || emp.hireDate || '—';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>اقرار استلام عمل</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: 'Cairo', Arial, sans-serif; background: white; }
  .page {
    width: 210mm; min-height: 297mm;
    border: 4px solid #000;
    margin: 0 auto;
    padding: 20mm 18mm 20mm 18mm;
    position: relative;
  }
  .title {
    text-align: center;
    font-size: 30px;
    font-weight: 900;
    margin-bottom: 50px;
    letter-spacing: 1px;
  }
  .row {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 28px;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .row .label { font-weight: 700; white-space: nowrap; }
  .row .value { font-weight: 600; border-bottom: 1px solid #888; flex: 1; padding-bottom: 2px; }
  .center-text {
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 28px;
  }
  .left-text {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 28px;
    display: flex;
    align-items: baseline;
    gap: 10px;
    direction: rtl;
  }
  .left-text .label { font-weight: 700; white-space: nowrap; }
  .left-text .value { border-bottom: 1px solid #888; flex: 1; padding-bottom: 2px; min-width: 120px; }
  .spacer { height: 40px; }
  .big-spacer { height: 70px; }
  @media print {
    body { margin: 0; }
    .page { border: 4px solid #000 !important; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="title">اقرار استلام عمل</div>

  <div class="row">
    <span class="label">اقر أنا :</span>
    <span class="value">${name}</span>
  </div>

  <div class="row">
    <span class="label">رقم قومى :</span>
    <span class="value">${nationalId}</span>
  </div>

  <div class="row">
    <span class="label">بأنى استلمت العمل بوظيفة :</span>
    <span class="value">${jobTitle}</span>
  </div>

  <div class="row">
    <span class="label">اعتبار من :</span>
    <span class="value">${hireDate}</span>
  </div>

  <div class="spacer"></div>
  <div class="center-text">وهذا الاقرار منى بذلك</div>
  <div class="big-spacer"></div>
  <div class="center-text">المقر بما فيه</div>
  <div class="big-spacer"></div>

  <div class="left-text">
    <span class="label">الاسم :</span>
    <span class="value">${name}</span>
  </div>

  <div class="left-text">
    <span class="label">التوقيع :</span>
    <span class="value"></span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // Upload modal
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load files from Firestore
  useEffect(() => {
    // Timeout fallback: if Firestore doesn't respond in 8s, stop loading
    const timeout = setTimeout(() => setLoading(false), 8000);

    let unsub: (() => void) | undefined;
    let empUnsub: (() => void) | undefined;

    try {
      const q = query(collection(dbToUse, 'hr_files'), orderBy('uploadedAt', 'desc'));
      unsub = onSnapshot(q, snap => {
        clearTimeout(timeout);
        setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as HRFile)));
        setLoading(false);
      }, () => { clearTimeout(timeout); setLoading(false); });

      // Load active employees for templates
      empUnsub = onSnapshot(collection(dbToUse, 'employees'), snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Employee))
          .filter(e => e.status !== 'resigned')
          .sort((a, b) => (a as any).sortOrder - (b as any).sortOrder || a.name.localeCompare(b.name, 'ar'));
        setEmployees(list);
      });
    } catch (err) {
      clearTimeout(timeout);
      setLoading(false);
    }

    return () => {
      clearTimeout(timeout);
      unsub && unsub();
      empUnsub && empUnsub();
    };
  }, [dbToUse]);

  const openModal = () => {
    setFileName('');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError('');
    setShowModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`حجم الملف (${formatSize(file.size)}) أكبر من الحد المسموح (${MAX_MB} MB)`);
      return;
    }
    setUploadError('');
    setSelectedFile(file);
    if (!fileName) setFileName(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile) { setUploadError('يرجى اختيار ملف'); return; }
    if (!fileName.trim()) { setUploadError('يرجى إدخال اسم الملف'); return; }

    setIsUploading(true);
    setUploadError('');
    try {
      const ext = selectedFile.name.split('.').pop() || '';
      const storagePath = `hr_files/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, storagePath);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, selectedFile);
        task.on('state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(storageRef);

      await addDoc(collection(dbToUse, 'hr_files'), {
        name: fileName.trim(),
        originalName: selectedFile.name,
        type: selectedFile.type || `application/${ext}`,
        size: selectedFile.size,
        storageUrl: downloadUrl,
        storagePath,
        uploadedAt: serverTimestamp(),
        uploadedBy: currentUser,
      });

      setShowModal(false);
    } catch (e: any) {
      setUploadError('حدث خطأ أثناء الرفع: ' + (e.message || 'تحقق من الاتصال'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (file: HRFile) => {
    setIsDeleting(true);
    try {
      // حذف من Storage
      try { await deleteObject(ref(storage, file.storagePath)); } catch {}
      // حذف من Firestore
      await deleteDoc(doc(dbToUse, 'hr_files', file.id));
    } catch (e) { console.error(e); }
    finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleDownload = (file: HRFile) => {
    const a = document.createElement('a');
    a.href = file.storageUrl;
    a.target = '_blank';
    a.download = file.originalName || file.name;
    a.click();
  };

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"/>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-5 rounded-full blur-3xl pointer-events-none"/>

      {/* Header */}
      <div className="w-full flex items-center justify-between p-5 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-4 py-2 rounded-full shadow-sm transition-all">
          <ChevronLeft size={26}/><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-black text-[#3a2a1f]">ورق HR</h1>
        {tab === 'files' ? (
          <button onClick={openModal}
            className="flex items-center gap-2 bg-[#76151e] text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-[#8a1923] transition-all text-sm">
            <Plus size={16}/>إضافة ملف
          </button>
        ) : <div className="w-28"/>}
      </div>

      {/* Tabs */}
      <div className="px-5 mb-5 z-10 relative">
        <div className="flex gap-2">
          <button onClick={() => setTab('files')}
            className={`flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${tab === 'files' ? 'bg-[#76151e] text-white shadow-lg' : 'bg-white/50 text-[#5a4a3f] hover:bg-white/80'}`}>
            <FileText size={18}/>ملفات
          </button>
          <button onClick={() => setTab('templates')}
            className={`flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${tab === 'templates' ? 'bg-[#76151e] text-white shadow-lg' : 'bg-white/50 text-[#5a4a3f] hover:bg-white/80'}`}>
            <Construction size={18}/>نماذج جاهزة
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 z-10 relative">

        {/* ── TAB: FILES ── */}
        {tab === 'files' && (
          loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#76151e] border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-3xl bg-[#76151e]/10 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-[#76151e]/50"/>
              </div>
              <p className="text-[#a09080] font-bold text-base mb-2">لا توجد ملفات بعد</p>
              <p className="text-[#c0b0a0] text-sm font-bold">اضغط "إضافة ملف" لرفع أول ملف</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {files.map(file => (
                <div key={file.id} className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md p-4 flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-[#f0ebe3] border border-[#e0d8cc] flex items-center justify-center shrink-0">
                    {getFileIcon(file.type)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-[#3a2a1f] truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${getFileBadgeColor(file.type)}`}>
                        {getTypeLabel(file.type)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#a09080] font-bold">
                        <HardDrive size={10}/>{formatSize(file.size)}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#a09080] font-bold">
                        <Clock size={10}/>
                        {file.uploadedAt ? safeFmtDate(file.uploadedAt) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleDownload(file)}
                      className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center hover:scale-110 hover:shadow-md transition-all" title="تنزيل">
                      <Download size={15}/>
                    </button>
                    {deleteConfirmId === file.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(file)} disabled={isDeleting}
                          className="text-[10px] bg-red-600 text-white font-black px-2 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-all">
                          {isDeleting ? '...' : 'تأكيد'}
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] bg-gray-200 text-gray-700 font-black px-2 py-1.5 rounded-lg hover:bg-gray-300 transition-all">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(file.id)}
                        className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-400 hover:text-red-600 flex items-center justify-center hover:scale-110 hover:shadow-md transition-all" title="حذف">
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── TAB: TEMPLATES ── */}
        {tab === 'templates' && (() => {
          const templates = [
            { id: 's1',        label: 'س1',                  icon: '📋', ready: false },
            { id: 'contract',  label: 'عقد عمل',             icon: '📝', ready: false },
            { id: 'receipt',   label: 'استلام عمل',          icon: '✅', ready: true  },
            { id: 'social',    label: 'صحيفة الحالة الاجتماعية', icon: '👨‍👩‍👧', ready: false },
            { id: 's6',        label: 'س6',                  icon: '📋', ready: false },
            { id: 'resign',    label: 'استقالة',              icon: '🚶', ready: false },
            { id: 'clearance', label: 'إقرار وتبرئة ذمة',   icon: '📄', ready: false },
            { id: 'dues',      label: 'استلام مستحقات',     icon: '💰', ready: false },
          ];
          return (
            <div>
              <p className="text-sm font-bold text-[#7a6a5f] mb-4">اختر النموذج المطلوب لتوليده</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {templates.map(t => (
                  <button key={t.id} disabled={!t.ready}
                    onClick={() => t.id === 'receipt' && (setWorkReceiptModal(true), setSelectedEmpId(''), setManualNationalId(''), setManualHireDate(''))}
                    className={`relative flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all ${t.ready
                      ? 'bg-white/70 border-[#76151e]/30 hover:bg-white hover:border-[#76151e] hover:shadow-lg cursor-pointer'
                      : 'bg-white/30 border-[#d4c4b7] opacity-60 cursor-not-allowed'}`}>
                    <span className="text-3xl">{t.icon}</span>
                    <span className="font-black text-[#3a2a1f] text-sm text-center leading-tight">{t.label}</span>
                    {!t.ready && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full">قريباً</span>
                    )}
                    {t.ready && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded-full">متاح</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </main>
      <Footer/>

      {/* ═══ UPLOAD MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isUploading && setShowModal(false)}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#76151e] text-white">
              <div className="flex items-center gap-3">
                <Upload size={20}/>
                <p className="font-black">إضافة ملف جديد</p>
              </div>
              <button onClick={() => !isUploading && setShowModal(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all disabled:opacity-50" disabled={isUploading}>
                <X size={18}/>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Error */}
              {uploadError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 text-red-700 font-bold text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5"/>{uploadError}
                </div>
              )}

              {/* File Name */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">اسم الملف *</label>
                <input type="text" value={fileName} onChange={e => setFileName(e.target.value)}
                  placeholder="أدخل اسم الملف" disabled={isUploading}
                  className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] disabled:opacity-60"/>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">
                  الملف * <span className="text-[#a09080] normal-case font-bold">(حد أقصى {MAX_MB} MB)</span>
                </label>
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${selectedFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-[#d4c4b7] bg-white/50 hover:border-[#76151e]/40 hover:bg-[#76151e]/5'} ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {selectedFile ? (
                    <div className="flex items-center gap-3 justify-center">
                      {getFileIcon(selectedFile.type)}
                      <div className="text-right">
                        <p className="font-black text-[#3a2a1f] text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-[#7a6a5f] font-bold">{formatSize(selectedFile.size)}</p>
                      </div>
                      {!isUploading && <button onClick={e => { e.stopPropagation(); setSelectedFile(null); setUploadProgress(0); }} className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-all"><X size={12}/></button>}
                    </div>
                  ) : (
                    <div>
                      <Upload size={28} className="text-[#76151e]/40 mx-auto mb-2"/>
                      <p className="font-bold text-[#5a4a3f] text-sm">اضغط لاختيار ملف</p>
                      <p className="text-xs text-[#a09080] font-bold mt-1">PDF · Word · Excel · الصور</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept={ACCEPTED} className="hidden"
                  onChange={handleFileSelect} disabled={isUploading}/>
              </div>

              {/* Progress bar */}
              {isUploading && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#5a4a3f] mb-1">
                    <span>جاري الرفع...</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-[#e0d8cc] rounded-full h-2.5">
                    <div className="bg-[#76151e] h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#d6cfc3] bg-[#ece7df] flex gap-3">
              <button onClick={handleUpload} disabled={isUploading || !selectedFile}
                className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] disabled:opacity-50 transition-all">
                {isUploading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>{uploadProgress}%</> : <><Save size={16}/>حفظ الملف</>}
              </button>
              <button onClick={() => setShowModal(false)} disabled={isUploading}
                className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white disabled:opacity-50 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ WORK RECEIPT MODAL ═══ */}
      {workReceiptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setWorkReceiptModal(false)}>
          <div className="bg-[#f0ebe3] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#76151e] text-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-black">نموذج استلام عمل</p>
                  <p className="text-white/60 text-xs font-bold">اختر الموظف لتوليد النموذج</p>
                </div>
              </div>
              <button onClick={() => setWorkReceiptModal(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"><X size={18}/></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
              {/* Employee Select */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">اختر الموظف *</label>
                <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]">
                  <option value="">— اختر موظف —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Employee data preview */}
              {selectedEmp && (
                <div className="bg-white/80 border border-[#d4c4b7] rounded-2xl p-4 flex flex-col gap-2">
                  <p className="text-xs font-black text-[#7a6a5f] uppercase tracking-wide mb-1">بيانات الموظف</p>
                  <div className="flex gap-2 flex-wrap">
                    <div className="bg-[#f5f0ea] rounded-xl px-3 py-2 flex-1 min-w-[120px]">
                      <p className="text-[10px] text-[#a09080] font-bold">الاسم</p>
                      <p className="font-black text-[#3a2a1f] text-sm">{selectedEmp.name}</p>
                    </div>
                    <div className="bg-[#f5f0ea] rounded-xl px-3 py-2 flex-1 min-w-[120px]">
                      <p className="text-[10px] text-[#a09080] font-bold">الوظيفة</p>
                      <p className="font-black text-[#3a2a1f] text-sm">{selectedEmp.jobTitle || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* National ID */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">الرقم القومى</label>
                <input type="text" value={manualNationalId} onChange={e => setManualNationalId(e.target.value)}
                  placeholder="أدخل الرقم القومى للموظف" maxLength={14}
                  className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-mono font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e] placeholder:text-[#c0b0a0]"/>
              </div>

              {/* Hire Date */}
              <div>
                <label className="block text-xs font-black text-[#7a6a5f] mb-1.5 uppercase tracking-wide">تاريخ التعيين</label>
                <input type="date" value={manualHireDate} onChange={e => setManualHireDate(e.target.value)}
                  className="w-full bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 font-bold text-[#3a2a1f] focus:outline-none focus:ring-2 focus:ring-[#76151e]"/>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#d6cfc3] bg-[#ece7df] shrink-0 flex gap-3">
              <button onClick={generateWorkReceiptHTML} disabled={!selectedEmpId}
                className="flex-1 bg-[#76151e] text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#8a1923] disabled:opacity-50 transition-all">
                <Printer size={16}/>توليد النموذج
              </button>
              <button onClick={() => setWorkReceiptModal(false)}
                className="flex-1 bg-white/70 border border-[#d4c4b7] text-[#5a4a3f] py-3 rounded-2xl font-black hover:bg-white transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
