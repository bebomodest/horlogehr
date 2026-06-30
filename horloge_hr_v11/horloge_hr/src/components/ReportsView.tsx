import React, { useState, useEffect } from 'react';
import { ChevronLeft, FileText, Calendar, User, Clock, Loader2, BarChart3, Timer, CalendarDays, Plane, Printer, FileDown, ChevronDown, Users, Table2 } from 'lucide-react';
import { Footer } from './Footer';
import { db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { getFirebaseInstance } from '../lib/databaseManager';
import { logActivity } from './NotificationsPage';
import { format } from 'date-fns';

interface FingerprintRecord {
  id: string; employeeName: string; employeeJobTitle: string;
  date: string; status?: string; logs: { time: string; type: string }[];
  notes: string;
  shiftInfo?: { name: string; startTime: string; endTime: string; graceIn?: number; graceOut?: number; };
}
interface DeductionRecord { id: string; employeeName: string; type: string; daysCount: number; date: string; }

type ReportType = 'fingerprint' | 'delays' | 'weekly-rest' | 'annual-leave' | 'summary' | null;

const ARABIC_DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

const formatMins = (m: number) => {
  if (m <= 0) return '-';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}س ${min}د` : `${min}د`;
};

const statusLabel = (status?: string) => {
  if (status === 'paid') return { text: 'راحة أسبوعية', color: 'text-blue-600' };
  if (status === 'annual') return { text: 'إجازة سنوية', color: 'text-purple-600' };
  if (status === 'unexcused') return { text: 'غياب بدون إذن', color: 'text-red-600' };
  if (status === 'sick') return { text: 'إجازة مرضية', color: 'text-orange-600' };
  if (status === 'emergency') return { text: 'إجازة طارئة', color: 'text-yellow-600' };
  return null;
};

export default function ReportsView({ onBack }: { onBack: () => void }) {
  const dynamicInstance = getFirebaseInstance('reports');
  const hrInstance = getFirebaseInstance('hr');
  const dbToUse = dynamicInstance?.db || db;
  const dbForEmps = hrInstance?.db || db;

  const [selectedReportType, setSelectedReportType] = useState<ReportType>(null);
  const [employees, setEmployees] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportResults, setReportResults] = useState<FingerprintRecord[]>([]);
  const [deductions, setDeductions] = useState<DeductionRecord[]>([]);
  const [summaryDeductions, setSummaryDeductions] = useState<DeductionRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);

  useEffect(() => {
    getDocs(collection(dbForEmps, 'employees')).then(snap => {
      const sorted = snap.docs
        .map(d => ({ name: d.data().name as string, sortOrder: (d.data().sortOrder ?? 9999) as number, status: d.data().status }))
        .filter(e => e.name && e.status !== 'resigned')
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
      setEmployees(sorted.map(e => e.name));
    }).catch(() => {
      // fallback: لو فشل من dbForEmps، جرّب dbToUse
      getDocs(collection(dbToUse, 'employees')).then(snap => {
        const sorted = snap.docs
          .map(d => ({ name: d.data().name as string, sortOrder: (d.data().sortOrder ?? 9999) as number, status: d.data().status }))
          .filter(e => e.name && e.status !== 'resigned')
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ar'));
        setEmployees(sorted.map(e => e.name));
      }).catch(() => {});
    });
  }, [dbForEmps, dbToUse]);

  const toggleEmployee = (name: string) => {
    if (selectAll) { setSelectAll(false); setSelectedEmployees([name]); }
    else setSelectedEmployees(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const handleSelectAll = () => { setSelectAll(true); setSelectedEmployees([]); };

  const calculateDelays = (r: FingerprintRecord) => {
    if (!r.shiftInfo || r.logs.length === 0) return { lateness: 0, earlyDeparture: 0 };
    const { startTime, endTime, graceIn = 15, graceOut = 15 } = r.shiftInfo;
    const sorted = [...r.logs].sort((a, b) => a.time.localeCompare(b.time));
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const [iH, iM] = sorted[0].time.split(':').map(Number);
    const [oH, oM] = sorted[sorted.length - 1].time.split(':').map(Number);
    const lateness = (iH*60+iM) > (sH*60+sM+graceIn) ? (iH*60+iM)-(sH*60+sM) : 0;
    const earlyDeparture = (oH*60+oM) < (eH*60+eM-graceOut) ? (eH*60+eM)-(oH*60+oM) : 0;
    return { lateness, earlyDeparture };
  };

  // حساب عدد ساعات العمل الفعلية في اليوم = الفرق بين أول وآخر بصمة
  const calculateWorkMinutes = (r: FingerprintRecord): number => {
    if (!r.logs || r.logs.length < 2) return 0;
    const sorted = [...r.logs].sort((a, b) => a.time.localeCompare(b.time));
    const [iH, iM] = sorted[0].time.split(':').map(Number);
    const [oH, oM] = sorted[sorted.length - 1].time.split(':').map(Number);
    let mins = (oH * 60 + oM) - (iH * 60 + iM);
    if (mins < 0) mins += 24 * 60; // عبور منتصف الليل (شيفت ليلي)
    return mins;
  };

  const handleGenerate = async () => {
    if (!selectedReportType) return;
    setIsGenerating(true); setShowResults(false);
    try {
      const snap = await getDocs(query(collection(dbToUse, 'fingerprints')));
      let records: FingerprintRecord[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as FingerprintRecord));
      records = records.filter(r => r.date >= startDate && r.date <= endDate);
      if (!selectAll && selectedEmployees.length > 0 && selectedReportType !== 'summary')
        records = records.filter(r => selectedEmployees.includes(r.employeeName));

      // Load deductions for summary report
      if (selectedReportType === 'summary') {
        // جيب كل الموظفين من employees collection
        let allEmps: string[] = [];
        try {
          const empSnap = await getDocs(collection(dbToUse, 'employees'));
          allEmps = empSnap.docs.map(d => d.data().name).filter(Boolean);
        } catch (e) {
          console.warn('Could not fetch employees:', e);
        }

        // جيب الخصومات والبدلات
        try {
          const dSnap = await getDocs(collection(dbToUse, 'deductions'));
          const deds = dSnap.docs.map(d => ({ id: d.id, ...d.data() } as DeductionRecord))
            .filter(d => (d as any).date >= startDate && (d as any).date <= endDate);
          setDeductions(deds);
          setSummaryDeductions(deds);
        } catch (e) {
          console.warn('Could not fetch deductions:', e);
        }

        // قائمة الموظفين المستهدفين
        const empNames = (!selectAll && selectedEmployees.length > 0)
          ? selectedEmployees
          : allEmps;

        // ضيف placeholder لكل موظف مش عنده records
        empNames.forEach(name => {
          if (!records.find(r => r.employeeName === name)) {
            records.push({
              id: `placeholder_${name}`,
              employeeName: name,
              employeeJobTitle: '',
              date: startDate,
              status: 'no_data',
              logs: [],
              notes: '',
            } as any);
          }
        });

        // فلتر على الموظفين المختارين
        if (!selectAll && selectedEmployees.length > 0) {
          records = records.filter(r => selectedEmployees.includes(r.employeeName));
        }
      }

      if (selectedReportType === 'delays')
        records = records.filter(r => {
          if (r.status === 'paid' || r.status === 'annual') return false;
          const { lateness, earlyDeparture } = calculateDelays(r);
          return lateness > 0 || earlyDeparture > 0;
        });
      else if (selectedReportType === 'weekly-rest')
        records = records.filter(r => r.status === 'paid');
      else if (selectedReportType === 'annual-leave')
        records = records.filter(r => r.status === 'annual');

      // رتّب النتائج بنفس ترتيب صفحة قائمة الموظفين (employees array مرتبة بالفعل بـ sortOrder)
      const orderIndex: Record<string, number> = {};
      employees.forEach((name, idx) => { orderIndex[name] = idx; });

      records.sort((a, b) => {
        const ao = orderIndex[a.employeeName] ?? 9999;
        const bo = orderIndex[b.employeeName] ?? 9999;
        if (ao !== bo) return ao - bo;
        if (a.employeeName !== b.employeeName) return a.employeeName.localeCompare(b.employeeName, 'ar');
        return a.date.localeCompare(b.date);
      });
      setReportResults(records);
      setShowResults(true);
      const titles: Record<string, string> = { fingerprint: 'تقرير بصمة', delays: 'تقرير التأخيرات', 'weekly-rest': 'تقرير الراحة الأسبوعية', 'annual-leave': 'تقرير الإجازات السنوية', summary: 'التقرير المجمع' };
      logActivity(dbToUse, 'عرض تقرير', `تم عرض ${titles[selectedReportType!] || 'تقرير'} للفترة ${startDate} - ${endDate}`, 'النظام', 'report');
    } catch(e) { console.error(e); }
    finally { setIsGenerating(false); }
  };

  const groupedByEmployee = reportResults.reduce((acc, r) => {
    if (!acc[r.employeeName]) acc[r.employeeName] = [];
    acc[r.employeeName].push(r);
    return acc;
  }, {} as Record<string, FingerprintRecord[]>);

  // Summary stats per employee
  const getSummaryStats = (empName: string, records: FingerprintRecord[], localDeductions?: DeductionRecord[]) => {
    const deds = localDeductions || deductions;
    // شيل الـ placeholder records
    const realRecords = records.filter(r => !r.id?.startsWith('placeholder_'));

    // 1. أيام الحضور = حضور فعلي + راحة أسبوعية + إجازة سنوية
    const attendance = realRecords.filter(r =>
      !r.status || r.status === 'present' || r.status === 'paid' || r.status === 'annual'
    ).length;

    // 2. الراحة الأسبوعية
    const weeklyRest = realRecords.filter(r => r.status === 'paid').length;

    // 3. الإجازة السنوية
    const annualLeave = realRecords.filter(r => r.status === 'annual').length;

    // 4. الغياب
    const unexcused = realRecords.filter(r => r.status === 'unexcused').length;

    // 5. أيام التأخير (من بيانات البصمة)
    const delayDays = realRecords.filter(r => {
      if (r.status === 'paid' || r.status === 'annual' || r.status === 'unexcused') return false;
      const { lateness } = calculateDelays(r);
      return lateness > 0;
    }).length;

    // 6. الانصراف المبكر (من بيانات البصمة)
    const earlyDays = realRecords.filter(r => {
      if (r.status === 'paid' || r.status === 'annual' || r.status === 'unexcused') return false;
      const { earlyDeparture } = calculateDelays(r);
      return earlyDeparture > 0;
    }).length;

    // 7. الخصومات (أيام فقط - من صفحة الخصومات)
    const deductionDays = deds
      .filter(d => d.employeeName === empName && (d as any).type !== 'bonus')
      .filter(d => (d as any).unit === 'days' || !(d as any).unit)
      .reduce((s, d) => s + ((d as any).amount || (d as any).daysCount || 0), 0);

    // 8. البدل (أيام - من صفحة الخصومات)
    const bonusDays = deds
      .filter(d => d.employeeName === empName && (d as any).type === 'bonus')
      .reduce((s, d) => s + ((d as any).amount || 0), 0);

    return { attendance, weeklyRest, annualLeave, unexcused, delayDays, earlyDays, deductionDays, bonusDays };
  };

  const buildExportData = () => {
    const empLabel = selectAll ? 'كل الموظفين' : selectedEmployees.join('، ');
    const subtitle = `${empLabel}  |  ${startDate} - ${endDate}`;

    if (selectedReportType === 'summary') {
      const headers = ['الموظف', 'أيام الحضور', 'الراحة الأسبوعية', 'الإجازة السنوية', 'الغياب', 'أيام التأخير', 'الانصراف المبكر', 'الخصومات (أيام)', 'البدل (أيام)'];
      const rows = Object.entries(groupedByEmployee).map(([name, recs]) => {
        const s = getSummaryStats(name, recs, summaryDeductions);
        return [name, s.attendance, s.weeklyRest, s.annualLeave, s.unexcused, s.delayDays, s.earlyDays, s.deductionDays, s.bonusDays];
      });
      return { title: 'التقرير المجمع', subtitle, headers, rows, statsRows: [] };
    }

    const titles: Record<string, string> = {
      fingerprint: 'تقرير بصمة', delays: 'تقرير التأخيرات',
      'weekly-rest': 'تقرير الراحة الأسبوعية', 'annual-leave': 'تقرير الإجازات السنوية'
    };
    const tableHeaders: Record<string, string[]> = {
      fingerprint: ['الموظف', 'التاريخ', 'اليوم', 'البصمات / الحالة'],
      delays: ['الموظف', 'التاريخ', 'اليوم', 'تأخير دخول', 'خروج مبكر', 'أول دخول', 'آخر خروج'],
      'weekly-rest': ['الموظف', 'التاريخ', 'اليوم', 'الحالة'],
      'annual-leave': ['الموظف', 'التاريخ', 'اليوم', 'الحالة'],
    };

    const rows = reportResults.map(r => {
      const day = ARABIC_DAYS[new Date(r.date+'T00:00:00').getDay()];
      if (selectedReportType === 'fingerprint') {
        const sl = statusLabel(r.status);
        const cell = sl ? sl.text : (r.logs.length === 0 ? 'لا توجد بصمات' : r.logs.map(l=>l.time).join(' | '));
        return [r.employeeName, r.date, day, cell];
      } else if (selectedReportType === 'delays') {
        const { lateness, earlyDeparture } = calculateDelays(r);
        const sorted = [...r.logs].sort((a,b)=>a.time.localeCompare(b.time));
        return [r.employeeName, r.date, day, formatMins(lateness), formatMins(earlyDeparture), sorted[0]?.time||'-', sorted[sorted.length-1]?.time||'-'];
      } else {
        return [r.employeeName, r.date, day, r.status === 'paid' ? 'راحة أسبوعية' : 'إجازة سنوية'];
      }
    });

    // Stats for export
    const statsRows: { label: string; value: string }[] = [];
    Object.entries(groupedByEmployee).forEach(([name, recs]) => {
      if (selectedReportType === 'delays') {
        let tl = 0, te = 0;
        recs.forEach(r => { const d = calculateDelays(r); tl += d.lateness; te += d.earlyDeparture; });
        statsRows.push({ label: `${name} - إجمالي التأخير`, value: formatMins(tl) });
        statsRows.push({ label: `${name} - إجمالي الانصراف المبكر`, value: formatMins(te) });
      }
    });

    return { title: titles[selectedReportType!] || 'تقرير', subtitle, headers: tableHeaders[selectedReportType!] || [], rows, statsRows };
  };

  const exportPDF = async () => {
    const { buildReportHTML, exportAsPDF } = await import('../lib/exportTemplate');
    const { title, subtitle, headers, rows, statsRows } = buildExportData();
    const html = await buildReportHTML(title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, 'landscape');
    exportAsPDF(html, `${title}.pdf`);
  };
  const exportExcel = async () => {
    const ExcelJS = await import('exceljs');
    const { exportAsExcel } = await import('../lib/exportTemplate');
    const { title, subtitle, headers, rows, statsRows } = buildExportData();
    await exportAsExcel(ExcelJS, title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, `${title}.xlsx`);
  };
  const handlePrint = async () => {
    const { buildReportHTML, exportAsPDF } = await import('../lib/exportTemplate');
    const { title, subtitle, headers, rows, statsRows } = buildExportData();
    const html = await buildReportHTML(title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, 'landscape');
    exportAsPDF(html, '', true);
  };

  const reportTypes = [
    { id: 'fingerprint', label: 'تقرير بصمة', icon: <FileText size={28} strokeWidth={1.5} />, color: 'bg-[#76151e]', light: 'bg-[#76151e]/10 text-[#76151e]' },
    { id: 'delays', label: 'التأخيرات', icon: <Timer size={28} strokeWidth={1.5} />, color: 'bg-red-600', light: 'bg-red-50 text-red-600' },
    { id: 'weekly-rest', label: 'الراحة الأسبوعية', icon: <CalendarDays size={28} strokeWidth={1.5} />, color: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-600' },
    { id: 'annual-leave', label: 'الإجازات السنوية', icon: <Plane size={28} strokeWidth={1.5} />, color: 'bg-purple-600', light: 'bg-purple-50 text-purple-600' },
    { id: 'summary', label: 'التقرير المجمع', icon: <Table2 size={28} strokeWidth={1.5} />, color: 'bg-amber-600', light: 'bg-amber-50 text-amber-600' },
  ];

  const empLabel = selectAll ? 'كل الموظفين' : selectedEmployees.length === 0 ? 'اختر موظفين' : `${selectedEmployees.length} موظف`;

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f]">تقارير البصمة</h1>
        <div className="w-24" />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 z-10 relative pb-12">
        {/* Step 1: Report Type */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 mb-4 border border-white/60 shadow-md">
          <p className="font-bold text-[#5a4a3f] mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-[#76151e] text-white rounded-full flex items-center justify-center text-sm font-black">1</span>
            اختر نوع التقرير
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {reportTypes.map(rt => (
              <button key={rt.id} onClick={() => { setSelectedReportType(rt.id as ReportType); setShowResults(false); }}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${selectedReportType === rt.id ? 'border-[#76151e] bg-[#76151e]/5 shadow-md' : 'border-[#e6dfd3] bg-white/80 hover:bg-white hover:shadow-md'}`}>
                <div className={`w-14 h-14 rounded-2xl ${selectedReportType === rt.id ? rt.color + ' text-white' : rt.light} flex items-center justify-center shadow-sm transition-all`}>
                  {rt.icon}
                </div>
                <span className={`font-bold text-xs text-center leading-tight ${selectedReportType === rt.id ? 'text-[#76151e]' : 'text-[#3a2a1f]'}`}>{rt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedReportType && (
          <>
            {/* Step 2: Employees */}
            <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 mb-4 border border-white/60 shadow-md">
              <p className="font-bold text-[#5a4a3f] mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-[#76151e] text-white rounded-full flex items-center justify-center text-sm font-black">2</span>
                اختر الموظفين
              </p>
              <div className="relative">
                <button onClick={() => setEmpDropdownOpen(!empDropdownOpen)}
                  className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-3 px-4 flex items-center justify-between font-bold text-[#3a2a1f] hover:bg-white transition-all">
                  <div className="flex items-center gap-2"><Users size={18} className="text-[#76151e]" /><span>{empLabel}</span></div>
                  <ChevronDown size={18} className={`transition-transform ${empDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Employee selector modal */}
              {empDropdownOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEmpDropdownOpen(false)}>
                  <div className="bg-[#e0dcd0] rounded-3xl shadow-2xl w-full max-w-md border border-white/60 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-5 border-b border-[#d6cfc3]">
                      <h3 className="font-bold text-lg text-[#3a2a1f]">اختر الموظفين</h3>
                      <button onClick={() => setEmpDropdownOpen(false)} className="p-2 rounded-full hover:bg-white/40">
                        <ChevronDown size={20} className="rotate-180" />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[60vh]">
                      {/* Select All */}
                      <div onClick={handleSelectAll}
                        className={`flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#f0ebe3] border-b border-[#d6cfc3] ${selectAll ? 'bg-[#76151e]/5' : ''}`}>
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${selectAll ? 'bg-[#76151e] border-[#76151e]' : 'border-[#d4c4b7] bg-white'}`}>
                          {selectAll && <span className="text-white text-xs font-black">✓</span>}
                        </div>
                        <span className="font-black text-[#76151e] text-base">كل الموظفين</span>
                        <span className="mr-auto text-xs text-[#7a6a5f] font-bold bg-white/60 px-2 py-0.5 rounded-full">{employees.length} موظف</span>
                      </div>
                      {/* Employee list */}
                      {employees.map(emp => (
                        <div key={emp} onClick={() => toggleEmployee(emp)}
                          className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-[#f0ebe3] border-b border-[#e6dfd3] last:border-0 ${!selectAll && selectedEmployees.includes(emp) ? 'bg-[#76151e]/5' : ''}`}>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${!selectAll && selectedEmployees.includes(emp) ? 'bg-[#76151e] border-[#76151e]' : 'border-[#d4c4b7] bg-white'}`}>
                            {!selectAll && selectedEmployees.includes(emp) && <span className="text-white text-xs font-black">✓</span>}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-[#76151e]/10 flex items-center justify-center text-[#76151e] font-black text-sm shrink-0">
                            {emp.charAt(0)}
                          </div>
                          <span className="font-bold text-[#3a2a1f]">{emp}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-[#d6cfc3]">
                      <button onClick={() => setEmpDropdownOpen(false)}
                        className="w-full bg-[#76151e] text-white py-3 rounded-2xl font-bold hover:bg-[#8a1923] transition-all">
                        تأكيد الاختيار ({selectAll ? 'كل الموظفين' : `${selectedEmployees.length} موظف`})
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Date Range */}
            <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 mb-4 border border-white/60 shadow-md">
              <p className="font-bold text-[#5a4a3f] mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-[#76151e] text-white rounded-full flex items-center justify-center text-sm font-black">3</span>
                اختر الفترة الزمنية
              </p>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
            </div>

            <button onClick={handleGenerate} disabled={isGenerating}
              className="w-full bg-[#76151e] text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:bg-[#8a1923] transition-all flex items-center justify-center gap-3 disabled:opacity-50 mb-8">
              {isGenerating ? <Loader2 size={24} className="animate-spin" /> : <BarChart3 size={24} />}
              <span>{isGenerating ? 'جاري إنشاء التقرير...' : 'عرض التقرير'}</span>
            </button>
          </>
        )}

        {/* Results */}
        {showResults && (
          <div>
            {/* Export buttons */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <div className="bg-white/60 px-4 py-2 rounded-xl border border-white/60 text-sm font-bold text-[#5a4a3f]">
                إجمالي: <span className="text-[#76151e]">{selectedReportType === 'summary' ? Object.keys(groupedByEmployee).length + ' موظف' : reportResults.length + ' سجل'}</span>
              </div>
              <button onClick={exportPDF} className="bg-[#76151e] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#8a1923] transition-all shadow-md text-sm"><FileDown size={16} />PDF</button>
              <button onClick={exportExcel} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md text-sm"><FileDown size={16} />Excel</button>
              <button onClick={handlePrint} className="bg-[#5a4a3f] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#3a2a1f] transition-all shadow-md text-sm"><Printer size={16} />طباعة</button>
            </div>

            {/* SUMMARY REPORT */}
            {selectedReportType === 'summary' && (
              <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#76151e] text-white">
                      {['الموظف','أيام الحضور','الراحة الأسبوعية','الإجازة السنوية','الغياب','أيام التأخير','الانصراف المبكر','الخصومات (أيام)','البدل (أيام)'].map(h => (
                        <th key={h} className="px-3 py-3 text-center font-bold whitespace-nowrap text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedByEmployee).length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-10 text-[#7a6a5f] font-bold">لا توجد بيانات للفترة المحددة</td></tr>
                    ) : Object.entries(groupedByEmployee).map(([name, recs], i) => {
                      const s = getSummaryStats(name, recs, summaryDeductions);
                      return (
                        <tr key={name} className={i % 2 === 0 ? 'bg-white/40' : 'bg-[#faf7f3]'}>
                          <td className="px-3 py-3 text-center font-bold text-[#3a2a1f]">{name}</td>
                          <td className="px-3 py-3 text-center font-black text-emerald-600">{s.attendance}</td>
                          <td className="px-3 py-3 text-center font-bold text-blue-600">{s.weeklyRest}</td>
                          <td className="px-3 py-3 text-center font-bold text-purple-600">{s.annualLeave}</td>
                          <td className="px-3 py-3 text-center font-bold text-red-600">{s.unexcused}</td>
                          <td className="px-3 py-3 text-center font-bold text-orange-600">{s.delayDays}</td>
                          <td className="px-3 py-3 text-center font-bold text-amber-600">{s.earlyDays}</td>
                          <td className="px-3 py-3 text-center font-bold text-[#76151e]">{s.deductionDays}</td>
                          <td className="px-3 py-3 text-center font-bold text-emerald-600">{s.bonusDays}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  {Object.entries(groupedByEmployee).length > 0 && (() => {
                    const totals = Object.entries(groupedByEmployee).reduce((acc, [name, recs]) => {
                      const s = getSummaryStats(name, recs, summaryDeductions);
                      return {
                        attendance: acc.attendance + s.attendance,
                        weeklyRest: acc.weeklyRest + s.weeklyRest,
                        annualLeave: acc.annualLeave + s.annualLeave,
                        unexcused: acc.unexcused + s.unexcused,
                        delayDays: acc.delayDays + s.delayDays,
                        earlyDays: acc.earlyDays + s.earlyDays,
                        deductionDays: acc.deductionDays + s.deductionDays,
                        bonusDays: acc.bonusDays + s.bonusDays,
                      };
                    }, { attendance: 0, weeklyRest: 0, annualLeave: 0, unexcused: 0, delayDays: 0, earlyDays: 0, deductionDays: 0, bonusDays: 0 });
                    return (
                      <tfoot>
                        <tr className="bg-[#76151e]/10 font-black border-t-2 border-[#76151e]/20">
                          <td className="px-3 py-3 text-center font-black text-[#76151e]">الإجمالي</td>
                          <td className="px-3 py-3 text-center text-emerald-700 font-black">{totals.attendance}</td>
                          <td className="px-3 py-3 text-center text-blue-700 font-black">{totals.weeklyRest}</td>
                          <td className="px-3 py-3 text-center text-purple-700 font-black">{totals.annualLeave}</td>
                          <td className="px-3 py-3 text-center text-red-700 font-black">{totals.unexcused}</td>
                          <td className="px-3 py-3 text-center text-orange-700 font-black">{totals.delayDays}</td>
                          <td className="px-3 py-3 text-center text-amber-700 font-black">{totals.earlyDays}</td>
                          <td className="px-3 py-3 text-center text-[#76151e] font-black">{totals.deductionDays}</td>
                          <td className="px-3 py-3 text-center text-emerald-700 font-black">{totals.bonusDays}</td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}

            {/* OTHER REPORTS */}
            {selectedReportType !== 'summary' && Object.entries(groupedByEmployee).map(([empName, records]) => {
              let totalLateness = 0, totalEarly = 0;
              records.forEach(r => { const d = calculateDelays(r); totalLateness += d.lateness; totalEarly += d.earlyDeparture; });

              return (
                <div key={empName} className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#76151e] text-white flex items-center justify-center font-black text-lg">{empName?.charAt(0) ?? '?'}</div>
                    <h3 className="text-xl font-bold text-[#3a2a1f]">{empName}</h3>
                    <span className="text-sm text-[#7a6a5f] font-bold bg-white/60 px-3 py-1 rounded-full">{records.length} سجل</span>
                  </div>

                  <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/60 shadow-md overflow-x-auto mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#76151e] text-white">
                          <th className="px-4 py-3 text-center font-bold">التاريخ</th>
                          <th className="px-4 py-3 text-center font-bold">اليوم</th>
                          {selectedReportType === 'fingerprint' && <>
                            <th className="px-4 py-3 text-center font-bold">البصمات / الحالة</th>
                            <th className="px-4 py-3 text-center font-bold">ساعات العمل</th>
                            <th className="px-4 py-3 text-center font-bold">الشيفت</th>
                          </>}
                          {selectedReportType === 'delays' && <>
                            <th className="px-4 py-3 text-center font-bold">تأخير دخول</th>
                            <th className="px-4 py-3 text-center font-bold">خروج مبكر</th>
                            <th className="px-4 py-3 text-center font-bold">أول دخول</th>
                            <th className="px-4 py-3 text-center font-bold">آخر خروج</th>
                          </>}
                          {(selectedReportType === 'weekly-rest' || selectedReportType === 'annual-leave') &&
                            <th className="px-4 py-3 text-center font-bold">الحالة</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, i) => {
                          const day = ARABIC_DAYS[new Date(r.date+'T00:00:00').getDay()];
                          const sorted = [...r.logs].sort((a,b) => a.time.localeCompare(b.time));
                          const { lateness, earlyDeparture } = calculateDelays(r);
                          const sl = statusLabel(r.status);
                          return (
                            <tr key={r.id} className={i % 2 === 0 ? 'bg-white/40' : 'bg-[#faf7f3]'}>
                              <td className="px-4 py-3 text-center font-bold">{r.date}</td>
                              <td className="px-4 py-3 text-center">{day}</td>
                              {selectedReportType === 'fingerprint' && (
                                <>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {sl
                                      ? <span className={`font-bold ${sl.color}`}>{sl.text}</span>
                                      : r.logs.length === 0
                                        ? <span className="text-red-500 font-bold">لا توجد بصمات</span>
                                        : <span className="font-mono">{r.logs.map(l=>l.time).join('  |  ')}</span>
                                    }
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-[#3a2a1f]">
                                    {(() => {
                                      const mins = calculateWorkMinutes(r);
                                      return mins > 0 ? formatMins(mins) : '-';
                                    })()}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {r.shiftInfo
                                      ? <span className="bg-[#76151e]/10 text-[#76151e] font-bold px-2 py-1 rounded-full text-xs">{r.shiftInfo.name}</span>
                                      : <span className="text-gray-400">—</span>
                                    }
                                  </td>
                                </>
                              )}
                              {selectedReportType === 'delays' && <>
                                <td className={`px-4 py-3 text-center font-bold ${lateness > 0 ? 'text-red-600' : 'text-gray-400'}`}>{formatMins(lateness)}</td>
                                <td className={`px-4 py-3 text-center font-bold ${earlyDeparture > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{formatMins(earlyDeparture)}</td>
                                <td className="px-4 py-3 text-center font-mono">{sorted[0]?.time||'-'}</td>
                                <td className="px-4 py-3 text-center font-mono">{sorted[sorted.length-1]?.time||'-'}</td>
                              </>}
                              {(selectedReportType === 'weekly-rest' || selectedReportType === 'annual-leave') && (
                                <td className={`px-4 py-3 text-center font-bold ${sl?.color || 'text-purple-600'}`}>
                                  {sl?.text || (r.status === 'paid' ? 'راحة أسبوعية' : 'إجازة سنوية')}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* إحصائيات لكل موظف */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    {selectedReportType === 'fingerprint' && (
                      <>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-emerald-700 text-xs font-bold mb-1">أيام بصمة</p>
                          <p className="text-xl font-black text-emerald-600">{records.filter(r => r.logs.length > 0).length}</p>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                          <p className="text-red-700 text-xs font-bold mb-1">بدون بصمة</p>
                          <p className="text-xl font-black text-red-600">{records.filter(r => r.logs.length === 0 && !r.status?.match(/paid|annual/)).length}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                          <p className="text-blue-700 text-xs font-bold mb-1">إجازات</p>
                          <p className="text-xl font-black text-blue-600">{records.filter(r => r.status === 'paid' || r.status === 'annual').length}</p>
                        </div>
                        <div className="bg-[#76151e]/5 border border-[#76151e]/10 rounded-xl p-3 text-center">
                          <p className="text-[#76151e] text-xs font-bold mb-1">إجمالي ساعات العمل</p>
                          <p className="text-xl font-black text-[#76151e]">
                            {formatMins(records.reduce((sum, r) => sum + calculateWorkMinutes(r), 0))}
                          </p>
                        </div>
                      </>
                    )}
                    {selectedReportType === 'delays' && (totalLateness > 0 || totalEarly > 0) && (
                      <>
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                          <p className="text-red-700 text-xs font-bold mb-1">إجمالي التأخير</p>
                          <p className="text-xl font-black text-red-600">{formatMins(totalLateness)}</p>
                        </div>
                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                          <p className="text-orange-700 text-xs font-bold mb-1">إجمالي الانصراف المبكر</p>
                          <p className="text-xl font-black text-orange-600">{formatMins(totalEarly)}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                          <p className="text-amber-700 text-xs font-bold mb-1">أيام تأخير</p>
                          <p className="text-xl font-black text-amber-600">{records.filter(r => { const d = calculateDelays(r); return d.lateness > 0; }).length}</p>
                        </div>
                      </>
                    )}
                    {(selectedReportType === 'weekly-rest' || selectedReportType === 'annual-leave') && (
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center col-span-2">
                        <p className="text-purple-700 text-xs font-bold mb-1">إجمالي الأيام</p>
                        <p className="text-xl font-black text-purple-600">{records.length} يوم</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {reportResults.length === 0 && selectedReportType !== 'summary' && (
              <div className="text-center py-16 text-[#7a6a5f] font-bold text-xl">لا توجد نتائج للفترة المحددة</div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
