import React, { useState, useEffect } from 'react';
import { ChevronLeft, TrendingUp, TrendingDown, Award, AlertCircle, Users, Calendar, Filter, Loader2, BarChart3, Clock, MinusCircle } from 'lucide-react';
import { Footer } from './Footer';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface EmpStats {
  name: string;
  totalLateness: number; // minutes
  latenessDays: number;
  totalEarlyDeparture: number;
  deductionDays: number;
  attendanceDays: number;
  absentDays: number;
}

const formatMins = (m: number) => {
  if (m <= 0) return '-';
  const h = Math.floor(m / 60), min = m % 60;
  return h > 0 ? `${h}س ${min}د` : `${min}د`;
};

export default function StatisticsPage({ onBack }: { onBack: () => void }) {
  const dbHR = db;
  const dbFP = db;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmpStats[]>([]);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'lateness' | 'deductions' | 'attendance'>('lateness');

  const loadStats = async () => {
    setLoading(true);
    try {
      // Load fingerprints
      const fpSnap = await getDocs(query(collection(dbFP, 'fingerprints')));
      const records = fpSnap.docs.map(d => d.data()).filter(r => r.date >= startDate && r.date <= endDate);

      // Load deductions
      const dedSnap = await getDocs(query(collection(dbHR, 'deductions')));
      const deductions = dedSnap.docs.map(d => d.data()).filter(r => r.date >= startDate && r.date <= endDate);

      // Group by employee
      const empMap: Record<string, EmpStats> = {};

      records.forEach((r: any) => {
        if (!empMap[r.employeeName]) {
          empMap[r.employeeName] = { name: r.employeeName, totalLateness: 0, latenessDays: 0, totalEarlyDeparture: 0, deductionDays: 0, attendanceDays: 0, absentDays: 0 };
        }
        const e = empMap[r.employeeName];

        if (r.status === 'unexcused') { e.absentDays++; return; }
        if (r.status === 'paid' || r.status === 'annual') { e.attendanceDays++; return; }

        if (r.logs && r.logs.length > 0) {
          e.attendanceDays++;
          if (r.shiftInfo) {
            const sorted = [...r.logs].sort((a: any, b: any) => a.time.localeCompare(b.time));
            const [sH, sM] = r.shiftInfo.startTime.split(':').map(Number);
            const [eH, eM] = r.shiftInfo.endTime.split(':').map(Number);
            const [iH, iM] = sorted[0].time.split(':').map(Number);
            const [oH, oM] = sorted[sorted.length - 1].time.split(':').map(Number);
            const grace = r.shiftInfo.graceIn || 15;
            const lateness = (iH * 60 + iM) > (sH * 60 + sM + grace) ? (iH * 60 + iM) - (sH * 60 + sM) : 0;
            const early = (oH * 60 + oM) < (eH * 60 + eM - (r.shiftInfo.graceOut || 15)) ? (eH * 60 + eM) - (oH * 60 + oM) : 0;
            if (lateness > 0) { e.totalLateness += lateness; e.latenessDays++; }
            if (early > 0) e.totalEarlyDeparture += early;
          }
        }
      });

      deductions.forEach((d: any) => {
        if (!empMap[d.employeeName]) {
          empMap[d.employeeName] = { name: d.employeeName, totalLateness: 0, latenessDays: 0, totalEarlyDeparture: 0, deductionDays: 0, attendanceDays: 0, absentDays: 0 };
        }
        empMap[d.employeeName].deductionDays += d.daysCount || 0;
      });

      setStats(Object.values(empMap).filter(e => e.attendanceDays > 0 || e.deductionDays > 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); }, [startDate, endDate]);

  const setPreset = (months: number) => {
    const d = months === 0 ? new Date() : subMonths(new Date(), months - 1);
    setStartDate(format(startOfMonth(d), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(months === 0 ? new Date() : new Date()), 'yyyy-MM-dd'));
  };

  const topLateness = [...stats].sort((a, b) => b.totalLateness - a.totalLateness).slice(0, 5);
  const topDeductions = [...stats].sort((a, b) => b.deductionDays - a.deductionDays).slice(0, 5);
  const topAbsent = [...stats].sort((a, b) => b.absentDays - a.absentDays).slice(0, 5);
  const topAttendance = [...stats].sort((a, b) => b.attendanceDays - a.attendanceDays).slice(0, 5);

  const maxLateness = topLateness[0]?.totalLateness || 1;
  const maxDeductions = topDeductions[0]?.deductionDays || 1;
  const maxAbsent = topAbsent[0]?.absentDays || 1;

  return (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] font-sans bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between p-6 z-10 relative">
        <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm transition-all">
          <ChevronLeft size={28} /><span>رجوع</span>
        </button>
        <h1 className="text-2xl font-bold text-[#3a2a1f]">الإحصائيات</h1>
        <div className="w-24" />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 z-10 relative pb-12">
        {/* Filters */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-5 mb-6 border border-white/60 shadow-md">
          <div className="flex items-center gap-2 mb-4 text-[#76151e] font-bold">
            <Filter size={18} /><span>الفترة الزمنية</span>
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            {[{label:'هذا الشهر', v:0}, {label:'3 أشهر', v:3}, {label:'6 أشهر', v:6}, {label:'سنة', v:12}].map(p => (
              <button key={p.v} onClick={() => setPreset(p.v)}
                className="px-4 py-2 rounded-xl bg-[#76151e]/10 text-[#76151e] font-bold text-sm hover:bg-[#76151e] hover:text-white transition-all">
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7a6a5f] mb-1">من</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7a6a5f] mb-1">إلى</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white/80 border border-[#d4c4b7] rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] font-bold text-sm" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#76151e]" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'إجمالي الموظفين', value: stats.length, icon: <Users size={22} />, color: 'bg-blue-50 border-blue-100 text-blue-600' },
                { label: 'أعلى تأخير', value: topLateness[0] ? `${topLateness[0].name.split(' ')[0]}` : '-', icon: <Clock size={22} />, color: 'bg-red-50 border-red-100 text-red-600' },
                { label: 'أكثر خصومات', value: topDeductions[0] ? `${topDeductions[0].name.split(' ')[0]}` : '-', icon: <MinusCircle size={22} />, color: 'bg-orange-50 border-orange-100 text-orange-600' },
                { label: 'أعلى حضور', value: topAttendance[0] ? `${topAttendance[0].name.split(' ')[0]}` : '-', icon: <Award size={22} />, color: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
              ].map((c, i) => (
                <div key={i} className={`${c.color} border rounded-2xl p-4 text-center shadow-sm`}>
                  <div className="flex justify-center mb-2">{c.icon}</div>
                  <p className="text-xs font-bold mb-1 opacity-70">{c.label}</p>
                  <p className="font-black text-lg">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {[
                { id: 'lateness', label: 'التأخيرات', icon: <Clock size={16} /> },
                { id: 'deductions', label: 'الخصومات', icon: <MinusCircle size={16} /> },
                { id: 'attendance', label: 'الغياب', icon: <AlertCircle size={16} /> },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${activeTab === t.id ? 'bg-[#76151e] text-white shadow-md' : 'bg-white/60 text-[#5a4a3f] hover:bg-white/80'}`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Lateness Chart */}
            {activeTab === 'lateness' && (
              <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-md">
                <h3 className="text-lg font-bold text-[#3a2a1f] mb-6 flex items-center gap-2">
                  <Clock size={20} className="text-red-500" />
                  أكثر الموظفين تأخيراً
                </h3>
                {topLateness.length === 0 ? (
                  <p className="text-center text-[#7a6a5f] font-bold py-8">لا توجد بيانات تأخير</p>
                ) : (
                  <div className="space-y-4">
                    {topLateness.map((e, i) => (
                      <div key={e.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-400' : 'bg-amber-400'}`}>{i+1}</span>
                            <span className="font-bold text-[#3a2a1f]">{e.name}</span>
                          </div>
                          <div className="text-left">
                            <span className="font-black text-red-600">{formatMins(e.totalLateness)}</span>
                            <span className="text-xs text-[#7a6a5f] mr-2">({e.latenessDays} يوم)</span>
                          </div>
                        </div>
                        <div className="h-3 bg-[#e6dfd3] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-red-400 to-red-600 rounded-full transition-all duration-700"
                            style={{ width: `${(e.totalLateness / maxLateness) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Deductions Chart */}
            {activeTab === 'deductions' && (
              <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-md">
                <h3 className="text-lg font-bold text-[#3a2a1f] mb-6 flex items-center gap-2">
                  <MinusCircle size={20} className="text-orange-500" />
                  أكثر الموظفين خصومات وجزاءات
                </h3>
                {topDeductions.filter(e => e.deductionDays > 0).length === 0 ? (
                  <p className="text-center text-[#7a6a5f] font-bold py-8">لا توجد خصومات أو جزاءات</p>
                ) : (
                  <div className="space-y-4">
                    {topDeductions.filter(e => e.deductionDays > 0).map((e, i) => (
                      <div key={e.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm ${i === 0 ? 'bg-orange-500' : i === 1 ? 'bg-amber-400' : 'bg-yellow-400'}`}>{i+1}</span>
                            <span className="font-bold text-[#3a2a1f]">{e.name}</span>
                          </div>
                          <span className="font-black text-orange-600">{e.deductionDays} يوم</span>
                        </div>
                        <div className="h-3 bg-[#e6dfd3] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-orange-400 to-orange-600 rounded-full transition-all duration-700"
                            style={{ width: `${(e.deductionDays / maxDeductions) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Absent Chart */}
            {activeTab === 'attendance' && (
              <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/60 shadow-md">
                <h3 className="text-lg font-bold text-[#3a2a1f] mb-6 flex items-center gap-2">
                  <AlertCircle size={20} className="text-red-500" />
                  أكثر الموظفين غياباً بدون إذن
                </h3>
                {topAbsent.filter(e => e.absentDays > 0).length === 0 ? (
                  <p className="text-center text-[#7a6a5f] font-bold py-8">لا يوجد غياب مسجل</p>
                ) : (
                  <div className="space-y-4">
                    {topAbsent.filter(e => e.absentDays > 0).map((e, i) => (
                      <div key={e.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm ${i === 0 ? 'bg-red-600' : i === 1 ? 'bg-red-400' : 'bg-red-300'}`}>{i+1}</span>
                            <span className="font-bold text-[#3a2a1f]">{e.name}</span>
                          </div>
                          <span className="font-black text-red-600">{e.absentDays} يوم</span>
                        </div>
                        <div className="h-3 bg-[#e6dfd3] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-red-400 to-red-700 rounded-full transition-all duration-700"
                            style={{ width: `${(e.absentDays / maxAbsent) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
