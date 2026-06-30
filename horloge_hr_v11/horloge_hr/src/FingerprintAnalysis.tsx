import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { format, eachDayOfInterval, differenceInMinutes, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Upload, FileSpreadsheet, Calendar, User, AlertCircle, CheckCircle2, Clock, FileText, ArrowRight, Watch, Users, CalendarDays, Activity, ShieldCheck, ChevronLeft, ChevronUp, Fingerprint, Printer, X, Plus, Timer, ArrowDownRight, ArrowUpRight, Download, ChevronDown, Table, Save, LogIn } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Footer } from './components/Footer';
import { db } from './firebase';
import { collection, doc, setDoc, updateDoc, serverTimestamp, query, getDocs, limit, where } from 'firebase/firestore';
import { getFirebaseInstance } from './lib/databaseManager';
import { useToast } from './components/Toast';
import { logActivity } from './components/NotificationsPage';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceIn: number;
  graceOut: number;
}

interface AttendanceRecord {
  name: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  dateTime: Date;
}

const ARABIC_DAYS = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
];

const parseExcelDate = (excelDate: any): Date | null => {
  if (!excelDate) return null;
  if (excelDate instanceof Date) {
    if (isValid(excelDate)) {
      // xlsx parses dates as UTC. Convert to local date to avoid off-by-one errors.
      return new Date(excelDate.getUTCFullYear(), excelDate.getUTCMonth(), excelDate.getUTCDate());
    }
  }
  if (typeof excelDate === 'number') {
    const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    if (isValid(d)) {
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
  }
  if (typeof excelDate === 'string') {
    const dateOnly = excelDate.split(' ')[0];
    const parts = dateOnly.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const d1 = new Date(y, m, d);
        if (isValid(d1)) return d1;
      } else if (parts[2].length === 4) {
        let d = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (m > 11) {
          const temp = d;
          d = m + 1;
          m = temp - 1;
        }
        const d1 = new Date(y, m, d);
        if (isValid(d1)) return d1;
      }
    }
    const parsed = new Date(excelDate);
    if (isValid(parsed)) return parsed;
  }
  return null;
};

const parseExcelTime = (excelTime: any): string => {
  if (excelTime == null) return '00:00';
  if (excelTime instanceof Date) {
    if (isValid(excelTime)) {
      return `${excelTime.getUTCHours().toString().padStart(2, '0')}:${excelTime.getUTCMinutes().toString().padStart(2, '0')}`;
    }
  }
  if (typeof excelTime === 'number') {
    const fraction = excelTime % 1;
    const totalSeconds = Math.round(fraction * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  if (typeof excelTime === 'string') {
    const match = excelTime.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const lowerStr = excelTime.toLowerCase();
      const isPM = lowerStr.includes('pm') || lowerStr.includes('p.m') || lowerStr.includes('م');
      const isAM = lowerStr.includes('am') || lowerStr.includes('a.m') || lowerStr.includes('ص');
      
      if (isPM && !isAM && h < 12) h += 12;
      if (isAM && !isPM && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:${m}`;
    }
    // Try to parse as date if it contains time
    const parsed = new Date(excelTime);
    if (isValid(parsed)) {
      return `${parsed.getHours().toString().padStart(2, '0')}:${parsed.getMinutes().toString().padStart(2, '0')}`;
    }
    return excelTime;
  }
  return '00:00';
};

const formatTimeWithAMPM = (timeStr: string) => {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hoursStr, minutesStr] = timeStr.split(':');
  let hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours.toString().padStart(2, '0')}:${minutesStr} ${ampm}`;
};

export default function FingerprintAnalysis({ onBack, canEdit = true }: { onBack: () => void; canEdit?: boolean }) {
  const { addToast } = useToast();
  const dynamicInstance = getFirebaseInstance('fingerprint-analysis');
  const hrInstance = getFirebaseInstance('hr');
  const dbForEmps = hrInstance?.db || db;
  const dbForSaves = dynamicInstance?.db || db;


  const [step, setStep] = useState<'upload' | 'options' | 'report'>('upload');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employeeJobTitle, setEmployeeJobTitle] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [reportData, setReportData] = useState<any[]>([]);
  const [leaveOverrides, setLeaveOverrides] = useState<Record<string, string>>({});
  const [employeeMapping, setEmployeeMapping] = useState<Record<string, string>>({}); // Mapping: fingerprintName -> officialName
  const [officialToFingerprint, setOfficialToFingerprint] = useState<Record<string, string>>({}); // Mapping: officialName -> fingerprintName
  
  const SHIFTS_STORAGE_KEY = 'horloge_fingerprint_shifts';

  const [shifts, setShifts] = useState<Shift[]>(() => {
    try { return JSON.parse(localStorage.getItem('horloge_fingerprint_shifts') || '[]'); }
    catch { return []; }
  });

  // حفظ الشيفتات تلقائياً في كل تغيير
  useEffect(() => {
    try { localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts)); }
    catch {}
  }, [shifts]);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    graceIn: 15,
    graceOut: 15
  });
  const [dayShifts, setDayShifts] = useState<Record<string, string>>({});
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});

  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [addRecordDateStr, setAddRecordDateStr] = useState<string>('');
  const [newRecordTime, setNewRecordTime] = useState<string>('09:00');

  const [addRecordName, setAddRecordName] = useState<string>('');

  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [globalShiftId, setGlobalShiftId] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Test connection to dbFingerprints (Project 2)
    const testFingerprintDB = async () => {
      try {
        await getDocs(query(collection(dbForSaves, 'fingerprints'), limit(1)));
        console.log('Firebase Connected');
      } catch (e: any) {
        if (e.message.includes('permission-denied')) {
          addToast('تنبيه: لا تملك صلاحية الوصول لقاعدة البيانات', 'error');
        }
      }
    };
    testFingerprintDB();

    // Fetch employee mapping
    const fetchEmployees = async () => {
      try {
        const q = query(collection(dbForEmps, 'employees'));
        const snapshot = await getDocs(q);
        const mapping: Record<string, string> = {};
        const revMapping: Record<string, string> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.fingerprintName && data.name) {
            mapping[data.fingerprintName.trim()] = data.name.trim();
            revMapping[data.name.trim()] = data.fingerprintName.trim();
          }
        });
        setEmployeeMapping(mapping);
        setOfficialToFingerprint(revMapping);
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    fetchEmployees();

  }, [dbForEmps, dbForSaves]);

  const calculateDayStats = (day: any) => {
    const key = `${day.name}_${day.dateStr}`;
    const override = leaveOverrides[key];
    const shiftId = globalShiftId || dayShifts[key];
    const selectedShift = shifts.find(s => s.id === shiftId);

    let statusText = day.isAbsent ? 'غياب' : 'حضور';
    let isEffectivelyAbsent = day.isAbsent;
    let isPaidLeave = false;
    let isAnnualLeave = false;
    let latenessMinutes = 0;
    let earlyDepartureMinutes = 0;
    let totalWorkMinutes = 0;

    if (selectedShift && !day.isAbsent && day.records.length > 0) {
      const [startHour, startMinute] = selectedShift.startTime.split(':').map(Number);
      const [endHour, endMinute] = selectedShift.endTime.split(':').map(Number);

      const shiftStart = new Date(day.date);
      shiftStart.setHours(startHour, startMinute, 0, 0);

      const shiftEnd = new Date(day.date);
      shiftEnd.setHours(endHour, endMinute, 0, 0);
      if (endHour < startHour) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      const shiftMidpoint = new Date((shiftStart.getTime() + shiftEnd.getTime()) / 2);
      const allowedStart = new Date(shiftStart.getTime() + selectedShift.graceIn * 60000);
      const allowedEnd   = new Date(shiftEnd.getTime()   - selectedShift.graceOut * 60000);

      if (day.records.length === 1) {
        // سجل واحد فقط: نحدد إذا كان دخول أم خروج بالمقارنة مع المنتصف
        const record = day.records[0].dateTime;
        if (record <= shiftMidpoint) {
          // دخول — تحقق من التأخير
          if (record > allowedStart) {
            latenessMinutes = Math.max(0, differenceInMinutes(record, shiftStart));
          }
        } else {
          // خروج — تحقق من الانصراف المبكر
          if (record < allowedEnd) {
            earlyDepartureMinutes = Math.max(0, differenceInMinutes(shiftEnd, record));
          }
        }
      } else if (day.records.length >= 2) {
        const sortedRecs = [...day.records].sort((a: any, b: any) => a.dateTime - b.dateTime);
        const firstRecord = sortedRecs[0].dateTime;
        const lastRecord  = sortedRecs[sortedRecs.length - 1].dateTime;

        // تأخير الدخول
        if (firstRecord > allowedStart) {
          latenessMinutes = Math.max(0, differenceInMinutes(firstRecord, shiftStart));
        }

        // الانصراف المبكر — بدون شرط الـ midpoint (عندنا سجلين دائماً)
        if (lastRecord < allowedEnd) {
          earlyDepartureMinutes = Math.max(0, differenceInMinutes(shiftEnd, lastRecord));
        }
      }
    }

    if (!day.isAbsent && day.records.length >= 2) {
      const first = day.records[0].dateTime;
      const last = day.records[day.records.length - 1].dateTime;
      totalWorkMinutes = differenceInMinutes(last, first);
    }

    if (override === 'paid') {
      statusText = 'راحة أسبوعية';
      isEffectivelyAbsent = false;
      isPaidLeave = true;
    } else if (override === 'annual') {
      statusText = 'إجازة سنوية';
      isEffectivelyAbsent = false;
      isAnnualLeave = true;
    } else if (override === 'unexcused') {
      statusText = 'غياب';
      isEffectivelyAbsent = true;
    }

    return {
      statusText,
      isEffectivelyAbsent,
      isPaidLeave,
      isAnnualLeave,
      latenessMinutes,
      earlyDepartureMinutes,
      totalWorkMinutes,
      shiftName: selectedShift?.name || 'غير محدد'
    };
  };


  const handleSaveToSystem = async () => {
    if (filteredReportData.length === 0) {
      addToast('لا توجد بيانات للحفظ. يرجى رفع ملف أولاً.', 'error');
      return;
    }

    // جلب الـ mapping: fingerprintName -> officialName مع ترتيب الموظفين
    let currentMapping: Record<string, string> = {};
    let employeeSortOrder: Record<string, number> = {};
    try {
      const snapshot = await getDocs(query(collection(dbForEmps, 'employees')));
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fingerprintName && data.name && data.status !== 'resigned') {
          currentMapping[data.fingerprintName.trim()] = data.name.trim();
          employeeSortOrder[data.name.trim()] = data.sortOrder ?? 9999;
        }
      });
    } catch (e) {
      console.error('Error fetching employees:', e);
      currentMapping = employeeMapping;
    }

    // التحقق: fingerprintName من الشيت لازم يكون مسجل في شؤون الموظفين
    if (Object.keys(currentMapping).length > 0) {
      const uniqueFingerprintNames = [...new Set(
        filteredReportData.map((d: any) => d.fingerprintName?.trim() || d.name?.trim())
      )];

      const registeredFingerprintNames = Object.keys(currentMapping).map(k => k.trim().toLowerCase());
      const notRegistered = uniqueFingerprintNames.filter(
        name => name && !registeredFingerprintNames.includes(name.toLowerCase())
      );

      if (notRegistered.length > 0) {
        const namesList = notRegistered.map(n => `• ${n}`).join('\n');
        addToast(`الأسماء التالية غير مسجلة: ${notRegistered.join('، ')} — يرجى إضافتهم في شؤون الموظفين`, 'error');
        return;
      }
    }

    // ── حساب رصيد الإجازات السنوية وخصمها (يُحفظ دائماً، حتى لو أصبح الرصيد سالباً) ──
    const annualDaysByEmployee: Record<string, {
      officialName: string; days: string[];
      empDocId: string; balance: number;
    }> = {};

    try {
      const empSnap = await getDocs(query(collection(dbForEmps, 'employees')));
      empSnap.docs.forEach(d => {
        const data = d.data();
        if (data.name && data.status !== 'resigned') {
          annualDaysByEmployee[data.name.trim()] = {
            officialName: data.name.trim(),
            empDocId: d.id,
            days: [],
            balance: data.annualLeaveBalance ?? 0,
          };
        }
      });
    } catch (e) {
      console.error('Error fetching employees for leave check:', e);
    }

    // تجميع أيام الإجازة السنوية من leaveOverrides
    filteredReportData.forEach((day: any) => {
      const key = `${day.name}_${day.dateStr}`;
      if (leaveOverrides[key] === 'annual') {
        const name = day.name?.trim() || '';
        if (annualDaysByEmployee[name]) {
          annualDaysByEmployee[name].days.push(day.dateStr);
        }
      }
    });

    // يُخصم دائماً — حتى لو أصبح الرصيد سالباً (لا يوقف الحفظ)
    const overdrawnList: string[] = [];
    const deductList: { empDocId: string; name: string; newBalance: number; daysCount: number }[] = [];

    for (const entry of Object.values(annualDaysByEmployee)) {
      if (entry.days.length === 0) continue;
      const newBalance = entry.balance - entry.days.length; // يمكن أن يصبح سالباً عمداً
      deductList.push({ empDocId: entry.empDocId, name: entry.officialName, newBalance, daysCount: entry.days.length });
      if (newBalance < 0) {
        overdrawnList.push(`${entry.officialName} (تجاوز الرصيد بـ ${Math.abs(newBalance)} يوم)`);
      }
    }

    // تنبيه فقط (لا يوقف الحفظ) إذا تجاوز أحد الموظفين رصيده
    if (overdrawnList.length > 0) {
      addToast(
        `⚠️ تنبيه: لا يوجد رصيد إجازات كافٍ لدى: ${overdrawnList.join('، ')}. سيتم الحفظ وسيظهر الرصيد بالسالب.`,
        'error'
      );
    }

    setIsSaving(true);
    const dbId = (dbForSaves as any).databaseId || '(default)';
    const projId = (dbForSaves as any).app.options.projectId;
    addToast('جاري الحفظ...', 'info');

    // خصم رصيد الإجازات
    for (const ded of deductList) {
      try {
        await updateDoc(doc(dbForEmps, 'employees', ded.empDocId), {
          annualLeaveBalance: ded.newBalance,
        });
      } catch (e) {
        console.error(`Error updating leave balance for ${ded.name}:`, e);
      }
    }

    if (deductList.length > 0) {
      const summary = deductList.map(d => `${d.name}: خُصم ${d.daysCount} يوم`).join('، ');
      addToast(`✅ تم خصم أيام الإجازة: ${summary}`, 'success');
    }
    
    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    try {
      let lastSavedId = '';
      const batchPromises = filteredReportData.map(async (day) => {
        const key = `${day.name}_${day.dateStr}`;
        // officialName = الاسم الرسمي (عربي) - موجود في day.name
        const officialName = day.name?.trim() || '';
        // fingerprintName = الاسم في الشيت الأصلي (إنجليزي/رقم) - موجود في day.fingerprintName
        const fingerprintName = (day.fingerprintName || day.name)?.trim() || '';
        // Clean ID to prevent Firestore issues
        const safeFingerprintName = fingerprintName.replace(/[/.]/g, '_');
        const recordId = `system_${safeFingerprintName}_${day.dateStr}`.replace(/\s+/g, '_');
        
        const shiftId = globalShiftId || dayShifts[key];
        const selectedShift = shifts.find(s => s.id === shiftId);

        const recordData = {
          employeeName: officialName,
          fingerprintName: fingerprintName,
          employeeJobTitle: employeeJobTitle || '',
          date: day.dateStr,
          logs: day.records.map((r: any) => ({
            time: r.timeStr,
            type: 'manual'
          })),
          notes: dayNotes[key] || '',
          status: leaveOverrides[key] || (day.isAbsent ? 'unexcused' : 'present'),
          shiftInfo: selectedShift ? {
            name: selectedShift.name,
            startTime: selectedShift.startTime,
            endTime: selectedShift.endTime
          } : null,
          updatedAt: serverTimestamp(),
          uid: 'system'
        };

        try {
          await setDoc(doc(dbForSaves, 'fingerprints', recordId), recordData);
          successCount++;
          lastSavedId = recordId;
          if (successCount % 5 === 0) {
            
          }
        } catch (e: any) {
          console.error(`Error saving record ${recordId} to ${projId}/${dbId}:`, e);
          failCount++;
          lastError = e.message;
        }
      });

      await Promise.all(batchPromises);
      
      if (failCount === 0) {
        
        addToast(`✅ تم حفظ ${successCount} سجل بنجاح`, 'success');
      logActivity(dbForSaves, 'حفظ بصمات', `تم حفظ ${successCount} سجل بصمة في النظام`, 'النظام', 'fingerprint');
      } else if (successCount > 0) {
        
        addToast(`تم حفظ ${successCount} سجل، فشل ${failCount}`, 'error');
      } else {
        if (lastError.includes('permission-denied')) {
          
          addToast('فشل الحفظ: لا تملك صلاحية الكتابة. راجع Firestore Rules.', 'error');
        } else {
          
          addToast('فشل الحفظ. تأكد من الاتصال بالإنترنت.', 'error');
        }
      }
    } catch (error: any) {
      console.error('Error in batch save operation:', error);
      addToast('حدث خطأ غير متوقع أثناء الحفظ', 'error');
      
    } finally {
      setIsSaving(false);
      
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من امتداد الملف
    const fileName = file.name.toLowerCase();
    const isValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm');
    if (!isValidExtension) {
      addToast('يرجى رفع ملف Excel بامتداد xlsx أو xls فقط', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      addToast('فشل قراءة الملف من الجهاز. حاول مرة أخرى.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onload = async (evt) => {
      try {
        const ab = evt.target?.result;
        if (!ab) { addToast('لم يتم قراءة الملف. حاول مرة أخرى.', 'error'); return; }

        // تحويل ArrayBuffer إلى Uint8Array بشكل صريح لضمان التوافق
        const uint8Array = new Uint8Array(ab as ArrayBuffer);

        // محاولة القراءة بعدة طرق للتوافق مع كل أنواع ملفات Excel
        let wb: any;
        try {
          // المحاولة الأولى: xlsx مع cellDates
          wb = XLSX.read(uint8Array, { type: 'array', cellDates: true, codepage: 1256 });
        } catch {
          try {
            // المحاولة الثانية: بدون cellDates
            wb = XLSX.read(uint8Array, { type: 'array', cellDates: false });
          } catch {
            try {
              // المحاولة الثالثة: binary string
              const bstr = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
              wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
            } catch {
              // المحاولة الرابعة: buffer
              wb = XLSX.read(ab as ArrayBuffer, { type: 'buffer', cellDates: true });
            }
          }
        }

        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          addToast('الملف لا يحتوي على أي بيانات', 'error'); return;
        }

        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // قراءة البيانات — جرب json أولاً ثم csv
        let data: any[] = [];
        try {
          data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        } catch {
          const csv = XLSX.utils.sheet_to_csv(ws);
          const lines = csv.split('\n').filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim());
            data = lines.slice(1).map(line => {
              const vals = line.split(',');
              const obj: any = {};
              headers.forEach((h, i) => { obj[h] = vals[i]?.trim() || ''; });
              return obj;
            });
          }
        }

        if (!data || data.length === 0) {
          addToast('لم يتم العثور على بيانات في الملف', 'error'); return;
        }

        // عرض أول صف للتشخيص
        console.log('Excel columns found:', Object.keys(data[0]));

        const parsedData: AttendanceRecord[] = [];
        const uniqueNames = new Set<string>();

        data.forEach((row: any) => {
          // تطبيع المفاتيح
          const nr: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            nr[key.trim().toLowerCase().replace(/\s+/g, '_')] = row[key];
          });

          let nameRaw: any, dateRaw: any, timeRaw: any;

          // البحث في المفاتيح المطبّعة
          Object.keys(nr).forEach(key => {
            const v = nr[key];
            if (v === undefined || v === null || v === '') return;
            const kLower = key;

            // اسم الموظف
            if (!nameRaw && (
              kLower.includes('name') || kLower.includes('اسم') ||
              kLower.includes('employee') || kLower.includes('موظف') ||
              kLower.includes('الاسم') || kLower === 'no.' || kLower === 'no'
            )) nameRaw = v;

            // التاريخ
            if (!dateRaw && (
              kLower.includes('date') || kLower.includes('تاريخ') ||
              kLower.includes('data') || kLower.includes('يوم') ||
              kLower.includes('day') || kLower.includes('تاريخ_التسجيل') ||
              kLower.includes('check')
            )) dateRaw = v;

            // الوقت
            if (!timeRaw && (
              kLower.includes('time') || kLower.includes('وقت') ||
              kLower.includes('ساع') || kLower.includes('clock') ||
              kLower.includes('hour') || kLower.includes('الوقت')
            )) timeRaw = v;
          });

          // لو مفيش وقت منفصل، جرب نفس حقل التاريخ
          if (!timeRaw) timeRaw = dateRaw;

          if (nameRaw && dateRaw) {
            const dateObj = parseExcelDate(dateRaw);
            if (dateObj) {
              const dateStr = format(dateObj, 'yyyy-MM-dd');
              const timeStr = parseExcelTime(timeRaw);
              const [hours, minutes] = timeStr.split(':').map(Number);
              const dateTime = new Date(dateObj);
              dateTime.setHours(hours || 0, minutes || 0, 0, 0);

              const empName = String(nameRaw).trim();
              if (empName) {
                parsedData.push({ name: empName, dateStr, timeStr, dateTime });
                uniqueNames.add(empName);
              }
            }
          }
        });

        if (parsedData.length === 0) {
          addToast('لم يتم العثور على بيانات صحيحة في الملف', 'error');
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setRecords(parsedData);
        // ترتيب الموظفين بناء على sortOrder من Firestore (مع fallback آمن)
        let localSortOrder: Record<string, number> = {};
        try {
          const snapshot = await getDocs(query(collection(dbForEmps, 'employees')));
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.name) {
              const order = data.sortOrder ?? 9999;
              // store by official name
              localSortOrder[data.name.trim()] = order;
              // also store by fingerprintName so Excel names sort correctly
              if (data.fingerprintName) {
                localSortOrder[data.fingerprintName.trim()] = order;
              }
            }
          });
        } catch {
          // ignore — سيتم الترتيب أبجدياً
        }
        // ترتيب الموظفين بناءً على sortOrder (يشمل الاسم الرسمي والبصمة)
        const sortedEmps = Array.from(uniqueNames).sort((a, b) => {
          const ao = localSortOrder[a] ?? 9999;
          const bo = localSortOrder[b] ?? 9999;
          return ao !== bo ? ao - bo : a.localeCompare(b, 'ar');
        });
        setEmployees(sortedEmps);
        setStep('options');
        logActivity(dbForSaves, 'رفع ملف بصمة', `تم رفع ملف بصمة يحتوي على ${parsedData.length} سجل`, 'النظام', 'fingerprint');
      } catch (error: any) {
        console.error("Error parsing Excel file:", error);
        const msg = error?.message || '';
        if (msg.includes('password') || msg.includes('encrypt')) {
          addToast('الملف محمي بكلمة مرور — يرجى إزالة الحماية أولاً', 'error');
        } else if (msg.includes('Unsupported file') || msg.includes('not a valid')) {
          addToast('صيغة الملف غير مدعومة — يرجى حفظ الملف بصيغة xlsx أو xls وإعادة المحاولة', 'error');
        } else {
          addToast(`حدث خطأ أثناء قراءة الملف — ${msg || 'تأكد أن الملف xlsx أو xls غير تالف'}`, 'error');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddShift = () => {
    if (!newShift.name || !newShift.startTime || !newShift.endTime) {
      addToast('يرجى إدخال اسم الشيفت ووقت الحضور والانصراف', 'error');
      return;
    }
    
    const shift: Shift = {
      id: Date.now().toString(),
      name: newShift.name,
      startTime: newShift.startTime,
      endTime: newShift.endTime,
      graceIn: newShift.graceIn || 0,
      graceOut: newShift.graceOut || 0
    };
    
    setShifts([...shifts, shift]);
    setIsShiftModalOpen(false);
    setNewShift({ name: '', startTime: '09:00', endTime: '17:00', graceIn: 15, graceOut: 15 });
  };

  const generateReport = () => {
    if (!selectedEmployee || !startDate || !endDate) return;

    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    // targetEmployees will be the official names (or fingerprint names if not mapped)
    const targetEmployees = selectedEmployee === 'all' 
      ? (employees.map(e => employeeMapping[e] || e)) 
      : [employeeMapping[selectedEmployee] || selectedEmployee];
    
    // Deduplicate targetEmployees (in case multiple fingerprint names map to same official name)
    const uniqueTargetEmployees = Array.from(new Set(targetEmployees)) as string[];
    
    const days = eachDayOfInterval({ start, end });
    const report: any[] = [];

    uniqueTargetEmployees.forEach(officialName => {
      // Find all fingerprint names that map to this official name
      const matchingFingerprintNames = Object.keys(employeeMapping).filter(key => employeeMapping[key] === officialName);
      if (matchingFingerprintNames.length === 0) {
        // If it's a name from the file that wasn't mapped
        matchingFingerprintNames.push(officialName);
      }
      
      const empRecords = records.filter(r => 
        matchingFingerprintNames.includes(r.name) && 
        isWithinInterval(r.dateTime, { start, end })
      );

      // ── معالجة شيفت الليل (آخر يوم في الشهر) ──────────────────────────────
      // المشكلة: موظف بيبصم خروج بعد منتصف الليل (مثلاً 12:50 صباحاً) في شيفت
      // بدأ في اليوم السابق (يوم 30 أو 31). هذه البصمة تُسجَّل تلقائياً على أنها
      // "دخول يوم 1"، وبعدها بصمة الدخول الحقيقية لشيفت يوم 1 (مثلاً 3:00 صباحاً)
      // تُحسب غلط كـ "خروج". 
      //
      // الحل: أول بصمة في اليوم (بعد منتصف الليل مباشرة، قبل الساعة المحددة)
      // تخص خروج اليوم السابق — بشرط وجود سجل فعلي في اليوم السابق يثبت
      // أن الموظف كان في شيفت ليلي. باقي بصمات نفس اليوم (التي تأتي لاحقاً،
      // مثل دخول الساعة 3:00) تبقى كما هي = دخول اليوم الحالي.
      const allEmpRecords = records.filter(r => matchingFingerprintNames.includes(r.name));
      const recordsByDateStr: Record<string, AttendanceRecord[]> = {};
      allEmpRecords.forEach(r => {
        if (!recordsByDateStr[r.dateStr]) recordsByDateStr[r.dateStr] = [];
        recordsByDateStr[r.dateStr].push(r);
      });

      const NIGHT_CUTOFF_HOUR = 2; // بصمات بين 00:00 و 02:00 صباحاً تُعتبر مرشحة لتكون "خروج اليوم السابق"

      // تجميع سجلات هذا الموظف حسب اليوم لمعرفة أول سجل في كل يوم
      const empRecordsByDate: Record<string, AttendanceRecord[]> = {};
      empRecords.forEach(r => {
        if (!empRecordsByDate[r.dateStr]) empRecordsByDate[r.dateStr] = [];
        empRecordsByDate[r.dateStr].push(r);
      });
      // رتب سجلات كل يوم بالوقت
      Object.values(empRecordsByDate).forEach(arr => arr.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()));

      const adjustedEmpRecords: AttendanceRecord[] = [];

      Object.entries(empRecordsByDate).forEach(([dateStr, dayRecs]) => {
        dayRecs.forEach((r, idx) => {
          const hour = r.dateTime.getHours();
          const isFirstRecordOfDay = idx === 0;

          if (isFirstRecordOfDay && hour < NIGHT_CUTOFF_HOUR) {
            // التاريخ السابق لهذا اليوم
            const prevDate = new Date(r.dateTime);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = format(prevDate, 'yyyy-MM-dd');

            // هل يوجد سجل فعلي للموظف في اليوم السابق؟ (دليل على شيفت ليلي بدأ هناك)
            const hasPrevDayRecord = (recordsByDateStr[prevDateStr] || []).length > 0;

            if (hasPrevDayRecord) {
              // أعد إسناد هذه البصمة كـ "خروج" لليوم السابق
              adjustedEmpRecords.push({ ...r, dateStr: prevDateStr });
              return;
            }
          }
          // غير ذلك: تبقى كما هي (دخول/خروج اليوم الحالي)
          adjustedEmpRecords.push(r);
        });
      });

      const groupedByDate: Record<string, AttendanceRecord[]> = {};
      adjustedEmpRecords.forEach(r => {
        if (!groupedByDate[r.dateStr]) groupedByDate[r.dateStr] = [];
        groupedByDate[r.dateStr].push(r);
      });

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayRecords = groupedByDate[dateStr] || [];
        dayRecords.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

        report.push({
          name: officialName,
          fingerprintName: matchingFingerprintNames[0] || officialName, // الاسم الأصلي من الشيت
          date: day,
          dateStr,
          records: dayRecords,
          isAbsent: dayRecords.length === 0
        });
      });
    });

    report.sort((a, b) => {
      if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
      return a.name.localeCompare(b.name);
    });

    setReportData(report);
    setLeaveOverrides({});
    setStep('report');
  };

  const handleDragStart = (e: React.DragEvent, sourceDateStr: string, sourceName: string, recordIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ sourceDateStr, sourceName, recordIndex }));
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string, targetName: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    
    try {
      const { sourceDateStr, sourceName, recordIndex } = JSON.parse(data);
      if (sourceDateStr === targetDateStr && sourceName === targetName) return;

      setReportData(prevData => {
        const newData = [...prevData];
        const sourceDayIndex = newData.findIndex(d => d.dateStr === sourceDateStr && d.name === sourceName);
        const targetDayIndex = newData.findIndex(d => d.dateStr === targetDateStr && d.name === targetName);
        
        if (sourceDayIndex === -1 || targetDayIndex === -1) return prevData;

        const sourceDay = { ...newData[sourceDayIndex] };
        const targetDay = { ...newData[targetDayIndex] };

        const recordToMove = sourceDay.records[recordIndex];
        
        // Update record's date to match target
        const newDateTime = new Date(recordToMove.dateTime);
        newDateTime.setFullYear(targetDay.date.getFullYear(), targetDay.date.getMonth(), targetDay.date.getDate());
        
        const updatedRecord = {
          ...recordToMove,
          name: targetName,
          dateStr: targetDateStr,
          dateTime: newDateTime
        };

        // Remove from source
        sourceDay.records = sourceDay.records.filter((_: any, idx: number) => idx !== recordIndex);
        sourceDay.isAbsent = sourceDay.records.length === 0;
        
        // Add to target
        targetDay.records = [...targetDay.records, updatedRecord];
        targetDay.records.sort((a: any, b: any) => a.dateTime.getTime() - b.dateTime.getTime());
        targetDay.isAbsent = targetDay.records.length === 0;

        newData[sourceDayIndex] = sourceDay;
        newData[targetDayIndex] = targetDay;

        return newData;
      });
    } catch (err) {
      console.error('Error parsing drag data', err);
    }
  };

  const handleDeleteRecord = (dateStr: string, name: string, recordIndex: number) => {
    setReportData(prevData => {
      const newData = [...prevData];
      const dayIndex = newData.findIndex(d => d.dateStr === dateStr && d.name === name);
      if (dayIndex === -1) return prevData;

      const day = { ...newData[dayIndex] };
      day.records = day.records.filter((_: any, idx: number) => idx !== recordIndex);
      day.isAbsent = day.records.length === 0;
      
      newData[dayIndex] = day;
      return newData;
    });
  };

  const handleAddManualRecord = () => {
    if (!addRecordDateStr || !newRecordTime || !addRecordName) return;

    setReportData(prevData => {
      const newData = [...prevData];
      const dayIndex = newData.findIndex(d => d.dateStr === addRecordDateStr && d.name === addRecordName);
      if (dayIndex === -1) return prevData;

      const day = { ...newData[dayIndex] };
      
      const [hours, minutes] = newRecordTime.split(':').map(Number);
      const newDateTime = new Date(day.date);
      newDateTime.setHours(hours, minutes, 0, 0);

      const newRecord: AttendanceRecord = {
        name: addRecordName,
        dateStr: addRecordDateStr,
        timeStr: newRecordTime,
        dateTime: newDateTime
      };

      day.records = [...day.records, newRecord];
      day.records.sort((a: AttendanceRecord, b: AttendanceRecord) => a.dateTime.getTime() - b.dateTime.getTime());
      day.isAbsent = day.records.length === 0;
      
      newData[dayIndex] = day;
      return newData;
    });

    setIsAddRecordModalOpen(false);
    setNewRecordTime('09:00');
  };

  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    
    let hText = `${h} ساعة`;
    if (h === 1) hText = 'ساعة';
    else if (h === 2) hText = 'ساعتين';
    else if (h >= 3 && h <= 10) hText = `${h} ساعات`;

    let mText = `${m} دقيقة`;
    if (m === 1) mText = 'دقيقة';
    else if (m === 2) mText = 'دقيقتين';
    else if (m >= 3 && m <= 10) mText = `${m} دقائق`;

    if (h > 0 && m > 0) return `\u200F${hText} و ${mText}`;
    if (h > 0) return `\u200F${hText}`;
    return `\u200F${mText}`;
  };

  const isAll = selectedEmployee === 'all';

  const uniqueEmployees = useMemo(() => {
    if (!isAll) return [];
    return Array.from(new Set(reportData.map(d => d.name))).sort();
  }, [reportData, isAll]);

  const uniqueDates = useMemo(() => {
    return Array.from(new Set(reportData.map(d => d.dateStr))).sort();
  }, [reportData]);

  const filteredReportData = useMemo(() => {
    return reportData.filter(day => {
      const matchEmployee = employeeFilter ? day.name === employeeFilter : true;
      const matchDate = dateFilter ? day.dateStr === dateFilter : true;
      return matchEmployee && matchDate;
    });
  }, [reportData, employeeFilter, dateFilter]);

  const { totalLateness, totalEarlyDeparture, totalWorkMinutesMonth } = useMemo(() => {
    let lateness = 0;
    let early = 0;
    let work = 0;

    filteredReportData.forEach(day => {
      const key = `${day.name}_${day.dateStr}`;
      const override = leaveOverrides[key];
      
      if (!day.isAbsent && day.records.length >= 2) {
        const first = day.records[0].dateTime;
        const last = day.records[day.records.length - 1].dateTime;
        work += differenceInMinutes(last, first);
      }

      if (override === 'paid' || override === 'annual' || override === 'unexcused') return;
      
      const shiftId = globalShiftId || dayShifts[key];
      const selectedShift = shifts.find(s => s.id === shiftId);

      if (selectedShift && !day.isAbsent && day.records.length > 0) {
        const [startHour, startMinute] = selectedShift.startTime.split(':').map(Number);
        const [endHour, endMinute] = selectedShift.endTime.split(':').map(Number);

        const shiftStart = new Date(day.date);
        shiftStart.setHours(startHour, startMinute, 0, 0);

        const shiftEnd = new Date(day.date);
        shiftEnd.setHours(endHour, endMinute, 0, 0);
        if (endHour < startHour) shiftEnd.setDate(shiftEnd.getDate() + 1);

        const shiftMidpoint = new Date((shiftStart.getTime() + shiftEnd.getTime()) / 2);
        const allowedStart  = new Date(shiftStart.getTime() + selectedShift.graceIn  * 60000);
        const allowedEnd    = new Date(shiftEnd.getTime()   - selectedShift.graceOut * 60000);

        if (day.records.length === 1) {
          const record = day.records[0].dateTime;
          if (record <= shiftMidpoint) {
            if (record > allowedStart) lateness += Math.max(0, differenceInMinutes(record, shiftStart));
          } else {
            if (record < allowedEnd)   early    += Math.max(0, differenceInMinutes(shiftEnd, record));
          }
        } else if (day.records.length >= 2) {
          const sorted      = [...day.records].sort((a: any, b: any) => a.dateTime - b.dateTime);
          const firstRecord = sorted[0].dateTime;
          const lastRecord  = sorted[sorted.length - 1].dateTime;
          if (firstRecord > allowedStart) lateness += Math.max(0, differenceInMinutes(firstRecord, shiftStart));
          if (lastRecord  < allowedEnd)   early    += Math.max(0, differenceInMinutes(shiftEnd,    lastRecord));
        }
      }
    });

    return { totalLateness: lateness, totalEarlyDeparture: early, totalWorkMinutesMonth: work };
  }, [filteredReportData, dayShifts, shifts, leaveOverrides, globalShiftId]);

  const getExportFileName = (extension: string) => {
    const name = selectedEmployee === 'all' ? 'كل الموظفين' : (selectedEmployee || 'تقرير');
    return `تقرير حضور انصراف - ${name}.${extension}`;
  };

  // ─── Shared helper: build table headers + data ───────────────────────────
  const buildExportData = () => {
    const isAll = selectedEmployee === 'all';
    const headers: string[] = [];
    if (isAll) headers.push('الموظف');
    headers.push('التاريخ', 'اليوم', 'الحالة');
    if (shifts.length > 0 && !globalShiftId) headers.push('نوع الشيفت');
    headers.push('سجل البصمات');
    if (shifts.length > 0) headers.push('تأخير دخول', 'خروج مبكر', 'ساعات العمل');

    const rows = filteredReportData.map((day: any) => {
      const row: any[] = [];
      const key = `${day.name}_${day.dateStr}`;
      if (isAll) row.push(day.name);
      row.push(day.dateStr);
      row.push(ARABIC_DAYS[day.date.getDay()]);
      const override = leaveOverrides[key];
      let statusText = day.isAbsent ? 'غياب' : 'حضور';
      if (override === 'paid') statusText = 'راحة أسبوعية';
      if (override === 'annual') statusText = 'إجازة سنوية';
      row.push(statusText);
      if (shifts.length > 0 && !globalShiftId) {
        const shift = shifts.find(s => s.id === dayShifts[key]);
        row.push(shift?.name || '-');
      }
      row.push(day.records.length === 0 ? '-' : day.records.map((r: any) => formatTimeWithAMPM(r.timeStr)).join('  |  '));
      if (shifts.length > 0) {
        const stats = calculateDayStats(day);
        row.push(formatMinutes(stats.latenessMinutes));
        row.push(formatMinutes(stats.earlyDepartureMinutes));
        row.push(formatMinutes(stats.totalWorkMinutes));
      }
      return row;
    });

    const employeeName = selectedEmployee === 'all' ? 'كل الموظفين' : selectedEmployee;
    const title = `تقرير حضور وانصراف - ${employeeName}`;
    const subtitle = `الفترة من: ${startDate} إلى: ${endDate}${employeeJobTitle ? '  |  الوظيفة: ' + employeeJobTitle : ''}`;

    // إحصائيات
    const statsRows: { label: string; value: string }[] = [
      {
        label: 'أيام الحضور',
        value: String(filteredReportData.filter((d: any) => {
          const ov = leaveOverrides[`${d.name}_${d.dateStr}`];
          if (ov === 'annual' || ov === 'paid') return true;
          if (ov === 'unexcused') return false;
          return !d.isAbsent;
        }).length)
      },
      {
        label: 'أيام الغياب',
        value: String(filteredReportData.filter((d: any) => {
          const ov = leaveOverrides[`${d.name}_${d.dateStr}`];
          if (ov === 'unexcused') return true;
          if (ov === 'annual' || ov === 'paid') return false;
          return d.isAbsent;
        }).length)
      },
      { label: 'الراحة الأسبوعية', value: String(filteredReportData.filter((d: any) => leaveOverrides[`${d.name}_${d.dateStr}`] === 'paid').length) },
      { label: 'الإجازات السنوية', value: String(filteredReportData.filter((d: any) => leaveOverrides[`${d.name}_${d.dateStr}`] === 'annual').length) },
      { label: 'إجمالي ساعات العمل', value: formatMinutes(totalWorkMinutesMonth) },
    ];
    if (shifts.length > 0) {
      statsRows.push(
        { label: 'إجمالي التأخير', value: formatMinutes(totalLateness) },
        { label: 'إجمالي الانصراف المبكر', value: formatMinutes(totalEarlyDeparture) }
      );
    }

    return { headers, rows, title, subtitle, statsRows };
  };

  // ─── PDF Export ───────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    try {
      const { buildReportHTML, exportAsPDF } = await import('./lib/exportTemplate');
      const { headers, rows, title, subtitle, statsRows } = buildExportData();
      const html = await buildReportHTML(title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, 'landscape');
      exportAsPDF(html, getExportFileName('pdf'));
    } catch (error) {
      console.error('PDF export failed:', error);
      addToast('حدث خطأ أثناء تصدير PDF', 'error');
    }
  };

  // ─── Print ────────────────────────────────────────────────────────────────
  const handlePrint = async () => {
    try {
      const { buildReportHTML, exportAsPDF } = await import('./lib/exportTemplate');
      const { headers, rows, title, subtitle, statsRows } = buildExportData();
      const html = await buildReportHTML(title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, 'landscape');
      exportAsPDF(html, '', true);
    } catch (error) {
      console.error('Print failed:', error);
    }
  };

  // ─── Excel Export ─────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    try {
      const { exportAsExcel } = await import('./lib/exportTemplate');
      const { headers, rows, title, subtitle, statsRows } = buildExportData();
      await exportAsExcel(ExcelJS, title, subtitle, 'النظام', 'مسؤول الموارد البشرية', headers, rows, statsRows, getExportFileName('xlsx'));
    } catch (error) {
      console.error('Excel export failed:', error);
      addToast('حدث خطأ أثناء تصدير Excel', 'error');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#e6e1d6] text-stone-900 font-sans relative overflow-x-hidden flex flex-col bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      
      {isShiftModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#e6e1d6] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#e6dfd3]" dir="rtl">
            <div className="bg-[#2c1e16] px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock size={20} className="text-[#d4c4b7]" />
                إضافة شيفت جديد
              </h3>
              <button 
                onClick={() => setIsShiftModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#5a4a3f] mb-1">اسم الشيفت</label>
                <input 
                  type="text" 
                  value={newShift.name}
                  onChange={e => setNewShift({...newShift, name: e.target.value})}
                  className="w-full border-2 border-[#e6dfd3] rounded-xl px-4 py-2.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] transition-colors"
                  placeholder="مثال: الشيفت الصباحي"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#5a4a3f] mb-1">وقت الحضور</label>
                  <input 
                    type="time" 
                    value={newShift.startTime}
                    onChange={e => setNewShift({...newShift, startTime: e.target.value})}
                    className="w-full border-2 border-[#e6dfd3] rounded-xl px-4 py-2.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#5a4a3f] mb-1">وقت الانصراف</label>
                  <input 
                    type="time" 
                    value={newShift.endTime}
                    onChange={e => setNewShift({...newShift, endTime: e.target.value})}
                    className="w-full border-2 border-[#e6dfd3] rounded-xl px-4 py-2.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] transition-colors"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#5a4a3f] mb-1">سماح الحضور (دقائق)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newShift.graceIn}
                    onChange={e => setNewShift({...newShift, graceIn: parseInt(e.target.value) || 0})}
                    className="w-full border-2 border-[#e6dfd3] rounded-xl px-4 py-2.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#5a4a3f] mb-1">سماح الانصراف (دقائق)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newShift.graceOut}
                    onChange={e => setNewShift({...newShift, graceOut: parseInt(e.target.value) || 0})}
                    className="w-full border-2 border-[#e6dfd3] rounded-xl px-4 py-2.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-[#e6dfd3]/50 px-6 py-4 flex justify-end gap-3">
              <button 
                onClick={() => setIsShiftModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-[#5a4a3f] bg-white border-2 border-[#e6dfd3] hover:bg-[#e6e1d6] transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAddShift}
                className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#76151e] hover:bg-[#5a0f16] transition-colors shadow-md"
              >
                حفظ الشيفت
              </button>
            </div>
          </div>
        </div>
      )}
      
      <header className="w-full px-6 py-4 flex items-center justify-between z-20 relative print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full bg-white/30 hover:bg-white/50 backdrop-blur-md transition-all text-[#3a2a1f]">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#3a2a1f] tracking-tight">اضافة بصمة</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full px-4 py-4 sm:py-8 z-10 relative">
        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 bg-[#fffdfa] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#e6dfd3] mt-4 sm:mt-10 relative overflow-hidden group px-4">
            {/* Decorative corner accents */}
            <div className="absolute top-0 right-0 w-12 sm:w-16 h-12 sm:h-16 border-t-4 border-r-4 border-[#76151e] opacity-20 m-2 sm:m-4 rounded-tr-lg transition-all duration-500 group-hover:opacity-40 group-hover:scale-110"></div>
            <div className="absolute bottom-0 left-0 w-12 sm:w-16 h-12 sm:h-16 border-b-4 border-l-4 border-[#76151e] opacity-20 m-2 sm:m-4 rounded-bl-lg transition-all duration-500 group-hover:opacity-40 group-hover:scale-110"></div>

            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#e0dcd0] text-[#76151e] rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-inner border border-[#e6dfd3] transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-md">
              <Upload size={40} sm:size={48} strokeWidth={1.5} className="transition-transform duration-300 group-hover:scale-110" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 text-[#3a2a1f] text-center transition-colors duration-300 group-hover:text-[#76151e]">رفع سجلات الحضور</h2>
            <p className="text-[#7a6a5f] mb-8 sm:mb-10 text-center max-w-md text-base sm:text-lg transition-colors duration-300 group-hover:text-[#5a4a3f]">
              قم برفع ملف الإكسيل الخاص بجهاز البصمة لعرض تقارير الموظفين
            </p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group/btn bg-white border-2 border-[#76151e] hover:bg-[#e0dcd0] text-[#76151e] px-6 sm:px-10 py-3 sm:py-4 rounded-md font-bold transition-all duration-300 flex items-center gap-3 shadow-lg hover:shadow-xl cursor-pointer transform hover:-translate-y-1 w-full sm:w-auto justify-center"
            >
              <FileSpreadsheet size={20} sm:size={22} className="transition-transform duration-300 group-hover/btn:rotate-12" />
              <span className="text-base sm:text-lg">اختيار ملف الإكسيل</span>
            </button>
          </div>
        )}

        {step === 'options' && (
          <div className="bg-[#fffdfa] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#e6dfd3] p-5 sm:p-8 max-w-2xl mx-auto mt-4 sm:mt-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#76151e] to-[#8a1923]"></div>
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 mb-8 pb-6 border-b border-[#e6dfd3] group text-center sm:text-right">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:bg-emerald-100 shrink-0">
                <CheckCircle2 size={28} className="transition-transform duration-300 group-hover:rotate-12" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#3a2a1f] transition-colors duration-300 group-hover:text-[#76151e]">تم قراءة السجلات بنجاح</h2>
                <p className="text-[#7a6a5f] text-sm sm:text-md mt-1 flex items-center justify-center sm:justify-start gap-2">
                  <Users size={16} className="text-[#76151e]" />
                  تم التعرف على <span className="font-bold text-[#5a4a3f]">{employees.length}</span> موظف في النظام
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="group/input">
                <label className="block text-md font-bold text-[#5a4a3f] mb-2 flex items-center gap-2 transition-colors duration-300 group-hover/input:text-[#76151e]">
                  <User size={18} className="text-[#76151e] transition-transform duration-300 group-hover/input:scale-110" />
                  <span>اسم الموظف</span>
                </label>
                <select 
                  value={selectedEmployee}
                  onChange={(e) => {
                    setSelectedEmployee(e.target.value);
                    setEmployeeFilter('');
                    setDateFilter('');
                  }}
                  className="w-full border-2 border-[#e6dfd3] rounded-md px-4 py-3 focus:ring-0 focus:border-[#76151e] hover:border-[#8a1923] outline-none transition-all duration-300 bg-[#faf8f5] text-[#3a2a1f] font-medium shadow-sm cursor-pointer"
                >
                  <option value="">-- تفضل باختيار الموظف --</option>
                  <option value="all">-- كل الموظفين --</option>
                  {employees.map(emp => (
                    <option key={emp} value={emp}>{employeeMapping[emp] || emp}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="group/input">
                  <label className="block text-md font-bold text-[#5a4a3f] mb-2 flex items-center gap-2 transition-colors duration-300 group-hover/input:text-[#76151e]">
                    <CalendarDays size={18} className="text-[#76151e] transition-transform duration-300 group-hover/input:scale-110" />
                    <span>من تاريخ</span>
                  </label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border-2 border-[#e6dfd3] rounded-md px-4 py-3 focus:ring-0 focus:border-[#76151e] hover:border-[#8a1923] outline-none transition-all duration-300 bg-[#faf8f5] text-[#3a2a1f] font-medium shadow-sm cursor-pointer"
                  />
                </div>
                <div className="group/input">
                  <label className="block text-md font-bold text-[#5a4a3f] mb-2 flex items-center gap-2 transition-colors duration-300 group-hover/input:text-[#76151e]">
                    <CalendarDays size={18} className="text-[#76151e] transition-transform duration-300 group-hover/input:scale-110" />
                    <span>إلى تاريخ</span>
                  </label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border-2 border-[#e6dfd3] rounded-md px-4 py-3 focus:ring-0 focus:border-[#76151e] hover:border-[#8a1923] outline-none transition-all duration-300 bg-[#faf8f5] text-[#3a2a1f] font-medium shadow-sm cursor-pointer"
                  />
                </div>
              </div>

                {shifts.length > 0 && (
                  <div className="mt-6 p-4 bg-[#e0dcd0] rounded-xl border-2 border-[#76151e]/20">
                    <label className="block text-md font-bold text-[#5a4a3f] mb-3 flex items-center gap-2">
                      <Clock size={20} className="text-[#76151e]" />
                      <span>اختيار الشيفت الافتراضي للتقرير (اختياري)</span>
                    </label>
                    <div className="relative group/select">
                      <select 
                        value={globalShiftId}
                        onChange={(e) => setGlobalShiftId(e.target.value)}
                        className="w-full appearance-none border-2 border-[#e6dfd3] rounded-md px-4 py-3 focus:ring-0 focus:border-[#76151e] hover:border-[#8a1923] outline-none transition-all duration-300 bg-white text-[#3a2a1f] font-medium shadow-sm cursor-pointer pr-10"
                      >
                        <option value="">-- اختيار شيفت ثابت لكل الأيام --</option>
                        {shifts.map(shift => (
                          <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime} - {shift.endTime})</option>
                        ))}
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#76151e]">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-[#7a6a5f]">
                      * عند اختيار شيفت هنا، سيتم تطبيقه تلقائياً على جميع أيام التقرير ولن يظهر عمود "نوع الشيفت" في الجدول.
                    </p>
                  </div>
                )}

                <div className="mt-8 border-t border-[#e6dfd3] pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#5a4a3f] flex items-center gap-2">
                    <Clock size={20} className="text-[#76151e]" />
                    إعدادات الشيفتات (اختياري)
                  </h3>
                  <button 
                    onClick={() => setIsShiftModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-[#76151e] text-[#76151e] rounded-lg font-bold text-sm hover:bg-[#76151e] hover:text-white transition-colors"
                  >
                    <Plus size={16} />
                    إضافة شيفت
                  </button>
                </div>
                
                {shifts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {shifts.map(shift => (
                      <div key={shift.id} className="bg-white border border-[#e6dfd3] rounded-xl p-4 shadow-sm relative group">
                        <button 
                          onClick={() => setShifts(shifts.filter(s => s.id !== shift.id))}
                          className="absolute top-2 left-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                        <h4 className="font-bold text-[#5a4a3f] mb-2">{shift.name}</h4>
                        <div className="text-sm text-[#7a6a5f] space-y-1">
                          <p>الحضور: {shift.startTime} (سماح {shift.graceIn} د)</p>
                          <p>الانصراف: {shift.endTime} (سماح {shift.graceOut} د)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#7a6a5f] bg-[#e0dcd0] p-4 rounded-lg border border-[#e6dfd3] text-center">
                    لم يتم إضافة أي شيفتات. يمكنك إضافة شيفتات لتحديد أوقات الحضور والانصراف لكل يوم.
                  </p>
                )}
              </div>

              <div className="pt-8 mt-4 border-t border-[#e6dfd3] flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={generateReport}
                  disabled={!selectedEmployee || !startDate || !endDate}
                  className="group/btn flex-1 bg-white border-2 border-[#76151e] hover:bg-[#e0dcd0] disabled:border-[#d4c4b7] disabled:text-[#d4c4b7] disabled:bg-white disabled:cursor-not-allowed text-[#76151e] px-6 py-4 rounded-md font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-md cursor-pointer transform hover:-translate-y-1 hover:shadow-lg w-full sm:w-auto"
                >
                  <FileText size={22} className="transition-transform duration-300 group-hover/btn:scale-110" />
                  <span className="text-lg">استخراج التقرير</span>
                </button>
                <button 
                  onClick={() => setStep('upload')}
                  className="group/btn px-8 py-4 rounded-md font-bold text-[#7a6a5f] hover:text-[#3a2a1f] hover:bg-[#e0dcd0] border-2 border-transparent hover:border-[#e6dfd3] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <ChevronLeft size={20} className="transition-transform duration-300 group-hover/btn:-translate-x-1" />
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'report' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between bg-[#fffdfa] p-4 sm:p-6 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] border border-[#e6dfd3] relative overflow-hidden group gap-4">
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-[#76151e] to-[#8a1923] transition-all duration-500 group-hover:w-3 print:hidden"></div>
              <div className="pr-0 sm:pr-4 text-center sm:text-right w-full sm:w-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#3a2a1f] mb-2 transition-colors duration-300 group-hover:text-[#76151e]">تقرير بصمة موظف</h2>
                <div className="text-[#7a6a5f] flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-base sm:text-lg">
                  <div className="flex items-center gap-1.5">
                    <User size={18} className="text-[#76151e]" />
                    <span className="font-bold text-[#5a4a3f]">{isAll ? 'كل الموظفين' : selectedEmployee}</span>
                  </div>
                  <span className="hidden sm:inline text-[#d4c4b7]">|</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={18} className="text-[#76151e]" />
                    <span dir="ltr" className="font-mono text-sm mt-1 font-bold">{startDate}</span>
                    <span className="text-xs">إلى</span>
                    <span dir="ltr" className="font-mono text-sm mt-1 font-bold">{endDate}</span>
                  </div>
                  {globalShiftId && (
                    <>
                      <span className="hidden sm:inline text-[#d4c4b7]">|</span>
                      <div className="flex items-center gap-1.5">
                        <Clock size={18} className="text-[#76151e]" />
                        <span className="font-bold text-[#5a4a3f]">الشيفت: {shifts.find(s => s.id === globalShiftId)?.name}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden w-full sm:w-auto">
                <button 
                  onClick={() => handlePrint()}
                  className="group/print text-[#e6e1d6] bg-[#76151e] hover:bg-[#5a0f16] px-5 py-2.5 rounded-md font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg w-full sm:w-auto"
                >
                  <Printer size={20} className="transition-transform duration-300 group-hover/print:scale-110" />
                  <span>طباعة التقرير</span>
                </button>
                <button 
                  onClick={() => setStep('options')}
                  className="group/back text-[#76151e] hover:text-[#5a0f16] hover:bg-[#e0dcd0] px-5 py-2.5 rounded-md font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer border border-transparent hover:border-[#e6dfd3] shadow-sm hover:shadow-md w-full sm:w-auto"
                >
                  <ArrowRight size={20} className="transition-transform duration-300 group-hover/back:translate-x-1" />
                  <span>عودة</span>
                </button>
              </div>
            </div>

            <div id="report-content" className="bg-[#fffdfa] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-[#e6dfd3] overflow-hidden p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-[#e0dcd0] border-b-2 border-[#d4c4b7]">
                    <tr>
                      {isAll && (
                        <th className="px-2 sm:px-4 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] w-[100px] sm:w-[150px] sticky right-[35px] sm:right-[50px] print:right-0 z-20 bg-[#e0dcd0] border-l border-[#d4c4b7]">
                          <div className="flex flex-col gap-1 sm:gap-2">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <User size={14} sm:size={18} className="text-[#76151e]" />
                              الموظف
                            </div>
                            <select
                              value={employeeFilter}
                              onChange={(e) => setEmployeeFilter(e.target.value)}
                              className="text-[10px] sm:text-xs font-normal border border-[#d4c4b7] rounded px-1 py-0.5 sm:py-1 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] print:hidden w-full"
                            >
                              <option value="">الكل</option>
                              {uniqueEmployees.map(emp => (
                                <option key={emp} value={emp}>{emp}</option>
                              ))}
                            </select>
                          </div>
                        </th>
                      )}
                      <th className={`px-2 sm:px-4 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] w-[100px] sm:w-[120px] sticky ${isAll ? 'right-[135px] sm:right-[200px] print:right-[150px]' : 'right-[35px] sm:right-[50px] print:right-0'} z-20 bg-[#e0dcd0] border-l border-[#d4c4b7]`}>
                        <div className="flex flex-col gap-1 sm:gap-2">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <CalendarDays size={14} sm:size={18} className="text-[#76151e]" />
                            التاريخ
                          </div>
                          {isAll && (
                            <select
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                              className="text-[10px] sm:text-xs font-normal border border-[#d4c4b7] rounded px-1 py-0.5 sm:py-1 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] print:hidden w-full"
                            >
                              <option value="">الكل</option>
                              {uniqueDates.map(date => (
                                <option key={date} value={date}>{date}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </th>
                      <th className={`px-2 sm:px-4 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] w-[80px] sm:w-[110px] sticky ${isAll ? 'right-[235px] sm:right-[320px] print:right-[270px]' : 'right-[135px] sm:right-[170px] print:right-[120px]'} z-20 bg-[#e0dcd0] shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] border-l border-[#d4c4b7]`}>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Activity size={14} sm:size={18} className="text-[#76151e]" />
                          اليوم
                        </div>
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <ShieldCheck size={14} sm:size={18} className="text-[#76151e]" />
                          الحالة
                        </div>
                      </th>
                      <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap print:hidden">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <CalendarDays size={14} sm:size={18} className="text-[#76151e]" />
                          تسجيل إجازة
                        </div>
                      </th>
                      {shifts.length > 0 && !globalShiftId && (
                        <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap print:hidden">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Clock size={14} sm:size={18} className="text-[#76151e]" />
                            نوع الشيفت
                          </div>
                        </th>
                      )}
                      <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f]">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Fingerprint size={14} sm:size={18} className="text-[#76151e]" />
                          سجل البصمات خلال اليوم
                        </div>
                      </th>
                      {shifts.length > 0 && (
                        <>
                          <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <ArrowDownRight size={14} sm:size={18} className="text-red-500" />
                              تأخير
                            </div>
                          </th>
                          <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <ArrowUpRight size={14} sm:size={18} className="text-orange-500" />
                              انصراف مبكر
                            </div>
                          </th>
                          <th className="px-3 sm:px-6 py-3 sm:py-5 text-xs sm:text-md font-bold text-[#5a4a3f] whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Clock size={14} sm:size={18} className="text-blue-500" />
                              إجمالي ساعات العمل
                            </div>
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6dfd3]">
                    {filteredReportData.map((day, idx) => {
                      const key = `${day.name}_${day.dateStr}`;
                      const stats = calculateDayStats(day);
                      const override = leaveOverrides[key];

                      const rowBgColor = stats.isPaidLeave ? '#bfdbfe' : (stats.isEffectivelyAbsent ? '#fecaca' : '#bbf7d0');
                      const textColorClass = stats.isPaidLeave ? 'text-blue-900' : (stats.isEffectivelyAbsent ? 'text-red-900' : 'text-green-900');

                      return (
                      <tr 
                        key={idx} 
                        className="group/row transition-all duration-300 hover:shadow-[inset_4px_0_0_0_#76151e]"
                        style={{ backgroundColor: rowBgColor }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, day.dateStr, day.name)}
                      >
                        {isAll && (
                          <td className="px-2 sm:px-4 py-3 sm:py-5 font-bold whitespace-nowrap text-xs sm:text-sm transition-colors duration-300 text-[#5a4a3f] sticky right-[35px] sm:right-[50px] print:right-0 z-10 bg-inherit border-l border-[#e6dfd3]">
                            {day.name}
                          </td>
                        )}
                        <td className={`px-2 sm:px-4 py-3 sm:py-5 font-bold whitespace-nowrap font-mono text-xs sm:text-sm transition-colors duration-300 ${textColorClass} sticky ${isAll ? 'right-[135px] sm:right-[200px] print:right-[150px]' : 'right-[35px] sm:right-[50px] print:right-0'} z-10 bg-inherit border-l border-[#e6dfd3]`}>
                          {day.dateStr}
                        </td>
                        <td className={`px-2 sm:px-4 py-3 sm:py-5 whitespace-nowrap font-medium transition-colors duration-300 ${textColorClass} sticky ${isAll ? 'right-[235px] sm:right-[320px] print:right-[270px]' : 'right-[135px] sm:right-[170px] print:right-[120px]'} z-10 bg-inherit shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] border-l border-[#e6dfd3]`}>
                          {ARABIC_DAYS[day.date.getDay()]}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap">
                          {stats.isEffectivelyAbsent ? (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-md bg-white text-[#5a4a3f] border border-[#e6dfd3] text-[10px] sm:text-sm font-bold shadow-sm transition-transform duration-300 group-hover/row:scale-105">
                              <AlertCircle size={14} sm:size={16} className="text-red-600" />
                              <span>{stats.statusText}</span>
                            </span>
                          ) : stats.isPaidLeave ? (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-md bg-white text-[#5a4a3f] border border-[#e6dfd3] text-[10px] sm:text-sm font-bold shadow-sm transition-transform duration-300 group-hover/row:scale-105">
                              <CheckCircle2 size={14} sm:size={16} className="text-blue-600" />
                              <span>{stats.statusText}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 sm:px-4 py-1 sm:py-1.5 rounded-md bg-white text-[#5a4a3f] border border-[#e6dfd3] text-[10px] sm:text-sm font-bold shadow-sm transition-transform duration-300 group-hover/row:scale-105">
                              <CheckCircle2 size={14} sm:size={16} className="text-green-600" />
                              <span>{stats.statusText}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap print:hidden">
                          {day.isAbsent ? (
                            <select
                              value={override || ''}
                              onChange={(e) => setLeaveOverrides({...leaveOverrides, [key]: e.target.value})}
                              className="text-[10px] sm:text-sm border border-[#d4c4b7] rounded-md px-1 sm:px-2 py-1 sm:py-1.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] cursor-pointer"
                            >
                              <option value="">-- افتراضي --</option>
                              <option value="paid">راحة أسبوعية</option>
                              <option value="annual">إجازة سنوية</option>
                              <option value="unexcused">غياب بدون إذن</option>
                            </select>
                          ) : (
                            <span className="text-[#d4c4b7] font-bold">-</span>
                          )}
                        </td>
                        {shifts.length > 0 && !globalShiftId && (
                          <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap print:hidden">
                            {!day.isAbsent ? (
                              <select
                                value={dayShifts[key] || ''}
                                onChange={(e) => setDayShifts({...dayShifts, [key]: e.target.value})}
                                className="text-[10px] sm:text-sm border border-[#d4c4b7] rounded-md px-1 sm:px-2 py-1 sm:py-1.5 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] cursor-pointer"
                              >
                                <option value="">-- بدون شيفت --</option>
                                {shifts.map(shift => (
                                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[#d4c4b7] font-bold">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 sm:px-6 py-3 sm:py-5 min-w-[150px]">
                          {day.isAbsent ? (
                            <span className="text-red-400 font-bold">-</span>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                              {day.records.map((r: any, i: number) => (
                                <div 
                                  key={i} 
                                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-[#e6dfd3] text-[#5a4a3f] text-[11px] sm:text-sm font-mono font-bold shadow-sm transition-all duration-300 hover:border-[#76151e] hover:shadow-md" 
                                  dir="ltr"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#76151e]/10 flex items-center justify-center text-[#76151e]">
                                      <Fingerprint size={12} />
                                    </div>
                                    {formatTimeWithAMPM(r.timeStr)}
                                  </div>
                                  <div className="flex items-center gap-1 print:hidden">
                                    <button
                                      onClick={() => {
                                        if (i === 0) return;
                                        setReportData(prev => {
                                          const newData = [...prev];
                                          const dayIdx = newData.findIndex(d => d.dateStr === day.dateStr && d.name === day.name);
                                          if (dayIdx === -1) return prev;
                                          const newDay = { ...newData[dayIdx], records: [...newData[dayIdx].records] };
                                          [newDay.records[i - 1], newDay.records[i]] = [newDay.records[i], newDay.records[i - 1]];
                                          newData[dayIdx] = newDay;
                                          return newData;
                                        });
                                      }}
                                      className="p-0.5 text-[#7a6a5f] hover:text-[#76151e] hover:bg-[#76151e]/10 rounded transition-colors disabled:opacity-30"
                                      disabled={i === 0}
                                      title="تحريك لأعلى"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (i === day.records.length - 1) return;
                                        setReportData(prev => {
                                          const newData = [...prev];
                                          const dayIdx = newData.findIndex(d => d.dateStr === day.dateStr && d.name === day.name);
                                          if (dayIdx === -1) return prev;
                                          const newDay = { ...newData[dayIdx], records: [...newData[dayIdx].records] };
                                          [newDay.records[i], newDay.records[i + 1]] = [newDay.records[i + 1], newDay.records[i]];
                                          newData[dayIdx] = newDay;
                                          return newData;
                                        });
                                      }}
                                      className="p-0.5 text-[#7a6a5f] hover:text-[#76151e] hover:bg-[#76151e]/10 rounded transition-colors disabled:opacity-30"
                                      disabled={i === day.records.length - 1}
                                      title="تحريك لأسفل"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteRecord(day.dateStr, day.name, i)}
                                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                      title="حذف البصمة"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        {shifts.length > 0 && (
                          <>
                            <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap font-bold text-red-600 text-[10px] sm:text-sm">
                              <div className="flex items-center gap-1.5">
                                {stats.latenessMinutes > 0 && <ArrowDownRight size={14} className="text-red-500" />}
                                <span>{formatMinutes(stats.latenessMinutes)}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap font-bold text-orange-600 text-[10px] sm:text-sm">
                              <div className="flex items-center gap-1.5">
                                {stats.earlyDepartureMinutes > 0 && <ArrowUpRight size={14} className="text-orange-500" />}
                                <span>{formatMinutes(stats.earlyDepartureMinutes)}</span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-5 whitespace-nowrap font-bold text-blue-600 text-[10px] sm:text-sm">
                              <div className="flex items-center gap-1.5">
                                {stats.totalWorkMinutes > 0 && <Clock size={14} className="text-blue-500" />}
                                <span>{formatMinutes(stats.totalWorkMinutes)}</span>
                              </div>
                            </td>
                          </>
                        )}

                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            

            {(!isAll || employeeFilter !== '') && (
              <div className="mt-10 pt-8 border-t border-[#e6dfd3]">
                <h3 className="text-2xl font-bold text-[#3a2a1f] mb-6 flex items-center gap-2">
                  <Activity size={24} className="text-[#76151e]" />
                  الإحصائيات
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
                  <div className="bg-emerald-50 border-2 border-emerald-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                    <div>
                      <p className="text-emerald-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                        ايام الحضور
                      </p>
                      <p className="text-emerald-600 text-xs sm:text-sm">اجمالى الايام التى تم تسجيل بصمة بها</p>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-emerald-700 drop-shadow-sm flex items-center gap-2">
                      <CheckCircle2 size={32} className="text-emerald-500 opacity-80" />
                      {filteredReportData.filter(d => {
                        const key = `${d.name}_${d.dateStr}`;
                        const override = leaveOverrides[key];
                        if (override === 'annual' || override === 'paid') return true;
                        if (override === 'unexcused') return false;
                        return !d.isAbsent;
                      }).length}
                    </div>
                  </div>
                  
                  <div className="bg-rose-50 border-2 border-rose-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                    <div>
                      <p className="text-rose-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                        <AlertCircle size={20} className="text-rose-600 transition-transform duration-300 group-hover:scale-110" />
                        ايام الغياب
                      </p>
                      <p className="text-rose-600 text-xs sm:text-sm">اجمالى الايام التى لم يتم تسجيل بصمة بها</p>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-rose-700 drop-shadow-sm flex items-center gap-2">
                      <AlertCircle size={32} className="text-rose-500 opacity-80" />
                      {filteredReportData.filter(d => {
                        const key = `${d.name}_${d.dateStr}`;
                        const override = leaveOverrides[key];
                        if (override === 'unexcused') return true;
                        if (override === 'annual' || override === 'paid') return false;
                        return d.isAbsent;
                      }).length}
                    </div>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                    <div>
                      <p className="text-blue-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                        الراحة الأسبوعية
                      </p>
                      <p className="text-blue-600 text-xs sm:text-sm">اجمالى أيام الراحة الأسبوعية</p>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-blue-700 drop-shadow-sm flex items-center gap-2">
                      <FileText size={32} className="text-blue-500 opacity-80" />
                      {filteredReportData.filter(d => leaveOverrides[`${d.name}_${d.dateStr}`] === 'paid').length}
                    </div>
                  </div>

                  <div className="bg-indigo-50 border-2 border-indigo-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                    <div>
                      <p className="text-indigo-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                        <CalendarDays size={20} className="text-indigo-600 transition-transform duration-300 group-hover:scale-110" />
                        الإجازات السنوية
                      </p>
                      <p className="text-indigo-600 text-xs sm:text-sm">اجمالى أيام الإجازات السنوية</p>
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-indigo-700 drop-shadow-sm flex items-center gap-2">
                      <CalendarDays size={32} className="text-indigo-500 opacity-80" />
                      {filteredReportData.filter(d => leaveOverrides[`${d.name}_${d.dateStr}`] === 'annual').length}
                    </div>
                  </div>

                  <div className="bg-violet-50 border-2 border-violet-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                    <div>
                      <p className="text-violet-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                        <Clock size={20} className="text-violet-600 transition-transform duration-300 group-hover:scale-110" />
                        إجمالي ساعات العمل
                      </p>
                      <p className="text-violet-600 text-xs sm:text-sm">مجموع ساعات العمل الفعلية خلال الشهر</p>
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-violet-700 drop-shadow-sm flex items-center gap-2">
                      <Clock size={28} className="text-violet-500 opacity-80" />
                      {formatMinutes(totalWorkMinutesMonth)}
                    </div>
                  </div>
                </div>

                {shifts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                    <div className="bg-orange-50 border-2 border-orange-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                      <div>
                        <p className="text-orange-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                          <ArrowDownRight size={20} sm:size={22} className="text-red-600 transition-transform duration-300 group-hover:scale-110" />
                          ساعات التأخير
                        </p>
                        <p className="text-orange-600 text-xs sm:text-sm">مجموع دقائق التأخير عن مواعيد الحضور</p>
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-orange-700 drop-shadow-sm flex items-center gap-2">
                        <ArrowDownRight size={28} className="text-orange-500 opacity-80" />
                        {formatMinutes(totalLateness)}
                      </div>
                    </div>

                    <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-4 sm:p-6 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow duration-300 group">
                      <div>
                        <p className="text-amber-800 font-bold text-lg sm:text-xl mb-1 flex items-center gap-2">
                          <ArrowUpRight size={20} sm:size={22} className="text-orange-600 transition-transform duration-300 group-hover:scale-110" />
                          ساعات الانصراف المبكر
                        </p>
                        <p className="text-amber-600 text-xs sm:text-sm">مجموع دقائق الانصراف قبل مواعيد الانصراف</p>
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-amber-700 drop-shadow-sm flex items-center gap-2">
                        <ArrowUpRight size={28} className="text-amber-500 opacity-80" />
                        {formatMinutes(totalEarlyDeparture)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4 print:hidden px-4">
              {/* Save to System Button */}
              <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleSaveToSystem}
                  disabled={!canEdit || isSaving}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 ${
                    isSaving 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-[#2c1e16] hover:bg-[#1a120c] text-white'
                  }`}
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={22} />
                  )}
                  حفظ البصمة على السيستم
                </button>
              </div>

              {/* Download Report Button with Dropdown */}
              <div className="relative w-full sm:w-auto">
                <button 
                  onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                  className="bg-[#76151e] hover:bg-[#5a0f16] text-white px-8 py-3.5 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 w-full sm:w-auto"
                >
                  <Download size={22} />
                  تنزيل التقرير
                  <ChevronDown size={18} className={`transition-transform duration-300 ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDownloadMenuOpen && (
                  <div className="absolute bottom-full mb-2 right-0 w-full bg-white rounded-xl shadow-2xl border border-[#e6dfd3] overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <button 
                      onClick={() => { exportToPDF(); setIsDownloadMenuOpen(false); }}
                      className="w-full text-right px-5 py-4 hover:bg-red-50 text-red-700 font-bold flex items-center gap-3 transition-colors border-b border-[#e6dfd3]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      بصيغة PDF
                    </button>
                    <button 
                      onClick={() => { exportToExcel(); setIsDownloadMenuOpen(false); }}
                      className="w-full text-right px-5 py-4 hover:bg-green-50 text-green-700 font-bold flex items-center gap-3 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <Table size={18} />
                      </div>
                      بصيغة Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isAddRecordModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#e6e1d6] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#e6dfd3]" dir="rtl">
              <div className="bg-[#2c1e16] px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Fingerprint size={20} className="text-[#d4c4b7]" />
                  إضافة بصمة يدوية
                </h3>
                <button 
                  onClick={() => setIsAddRecordModalOpen(false)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-white p-4 rounded-xl border border-[#e6dfd3] shadow-sm">
                  <p className="text-sm text-[#76151e] font-bold mb-1">التاريخ</p>
                  <p className="text-lg text-[#5a4a3f] font-mono">{addRecordDateStr}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#5a4a3f] mb-2">وقت البصمة</label>
                  <input 
                    type="time" 
                    value={newRecordTime}
                    onChange={(e) => setNewRecordTime(e.target.value)}
                    className="w-full border-2 border-[#d4c4b7] rounded-xl px-4 py-3 bg-white text-[#5a4a3f] focus:outline-none focus:border-[#76151e] focus:ring-2 focus:ring-[#76151e]/20 transition-all font-mono text-lg"
                  />
                </div>
              </div>

              <div className="bg-[#e6dfd3]/30 px-6 py-4 flex justify-end gap-3 border-t border-[#e6dfd3]">
                <button 
                  onClick={() => setIsAddRecordModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-[#5a4a3f] hover:bg-white border border-transparent hover:border-[#d4c4b7] transition-all"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleAddManualRecord}
                  className="px-5 py-2.5 bg-[#76151e] text-white rounded-xl font-bold hover:bg-[#5a0f16] transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  حفظ البصمة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Printable Area for PDF Export */}
        <div id="report-printable-area" className="hidden bg-[#e6e1d6] p-8 font-sans" dir="rtl">
          <div className="max-w-4xl mx-auto bg-white/40 backdrop-blur-md rounded-3xl p-10 border border-white/60 shadow-xl">
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-10">
              <img 
                src="https://up6.cc/2026/03/177489580765681.png" 
                alt="Logo" 
                className="h-24 object-contain mb-6" 
                referrerPolicy="no-referrer" 
              />
              <h1 className="text-3xl font-bold text-[#3a2a1f] mb-2">تقرير حضور وانصراف</h1>
              <p className="text-[#76151e] font-bold text-lg mb-1">استخراج التقرير: {format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
              <p className="text-[#5a4a3f] font-medium">المستخدم: {"النظام"}</p>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-1 gap-3 mb-8 text-right border-r-4 border-[#76151e] pr-6">
              <p className="text-xl font-bold text-[#3a2a1f]">اسم الموظف: <span className="font-medium">{isAll ? (employeeFilter || 'كل الموظفين') : selectedEmployee}</span></p>
              {!isAll && employeeJobTitle && <p className="text-lg font-bold text-[#3a2a1f]">الوظيفة: <span className="font-medium">{employeeJobTitle}</span></p>}
              <p className="text-lg font-bold text-[#3a2a1f]">المدة: <span className="font-medium">من {startDate} إلى {endDate}</span></p>
              {globalShiftId && (
                <p className="text-lg font-bold text-[#3a2a1f]">
                  الشيفت: <span className="font-medium">
                    {shifts.find(s => s.id === globalShiftId)?.name} ({shifts.find(s => s.id === globalShiftId)?.startTime} - {shifts.find(s => s.id === globalShiftId)?.endTime})
                  </span>
                </p>
              )}
            </div>

            {/* Table */}
            <table className="w-full border-collapse rounded-xl overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-[#76151e] text-white">
                  {isAll && <th className="p-3 text-right border border-white/20">الموظف</th>}
                  <th className="p-3 text-right border border-white/20">التاريخ</th>
                  <th className="p-3 text-right border border-white/20">اليوم</th>
                  <th className="p-3 text-right border border-white/20">الحالة</th>
                  <th className="p-3 text-right border border-white/20">تسجيل إجازة</th>
                  <th className="p-3 text-right border border-white/20">سجل البصمات</th>
                  {filteredReportData.some(d => dayNotes[`${d.name}_${d.dateStr}`]) && <th className="p-3 text-right border border-white/20">ملاحظات</th>}
                </tr>
              </thead>
              <tbody>
                {filteredReportData.map((day, idx) => {
                  const key = `${day.name}_${day.dateStr}`;
                  const override = leaveOverrides[key];
                  let statusText = day.isAbsent ? 'غياب' : 'حضور';
                  let isEffectivelyAbsent = day.isAbsent;
                  let isPaidLeave = false;

                  if (override === 'paid') {
                    statusText = 'راحة أسبوعية';
                    isEffectivelyAbsent = false;
                    isPaidLeave = true;
                  } else if (override === 'annual') {
                    statusText = 'إجازة سنوية';
                    isEffectivelyAbsent = false;
                  } else if (override === 'unexcused') {
                    statusText = 'غياب';
                    isEffectivelyAbsent = true;
                  }

                  const rowBg = isPaidLeave ? 'bg-blue-50' : (isEffectivelyAbsent ? 'bg-red-50' : 'bg-green-50');
                  const textColor = isPaidLeave ? 'text-blue-900' : (isEffectivelyAbsent ? 'text-red-900' : 'text-green-900');

                  return (
                    <tr key={idx} className={`${rowBg} ${textColor} border-b border-[#e6dfd3]`}>
                      {isAll && <td className="p-3 font-bold border border-[#e6dfd3]">{day.name}</td>}
                      <td className="p-3 font-mono border border-[#e6dfd3]">{day.dateStr}</td>
                      <td className="p-3 border border-[#e6dfd3]">{ARABIC_DAYS[day.date.getDay()]}</td>
                      <td className="p-3 font-bold border border-[#e6dfd3]">{statusText}</td>
                      <td className="p-3 border border-[#e6dfd3]">
                        {day.isAbsent ? (
                          override === 'paid' ? 'راحة أسبوعية' :
                          override === 'annual' ? 'إجازة سنوية' :
                          override === 'unexcused' ? 'غياب بدون إذن' : 'افتراضي'
                        ) : '-'}
                      </td>
                      <td className="p-3 border border-[#e6dfd3]">
                        <div className="flex flex-wrap gap-2">
                          {day.records.map((r: any, i: number) => (
                            <span key={i} className="px-2 py-1 bg-white/60 rounded border border-[#e6dfd3] text-xs font-mono font-bold">
                              {formatTimeWithAMPM(r.timeStr)}
                            </span>
                          ))}
                          {day.records.length === 0 && '-'}
                        </div>
                      </td>
                      {filteredReportData.some(d => dayNotes[`${d.name}_${d.dateStr}`]) && (
                        <td className="p-3 border border-[#e6dfd3] text-sm">
                          {dayNotes[key] || '-'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
