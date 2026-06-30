import React, { useState, useEffect } from 'react';
import FingerprintAnalysis from './FingerprintAnalysis';
import EmploymentContractPage from './EmploymentContractPage';
import EmployeeListPage from './EmployeeListPage';
import LeavesPage from './components/LeavesPage';
import SettingsView from './components/SettingsView';
import ReportsView from './components/ReportsView';
import ViewEditFingerprint from './components/ViewEditFingerprint';
import LoginPage from './components/LoginPage';
import FirebaseMigration from './components/FirebaseMigration';
import DeductionsPage from './components/DeductionsPage';
import StatisticsPage from './components/StatisticsPage';
import NotificationsPage from './components/NotificationsPage';
import { logActivity } from './components/NotificationsPage';
import { OfflineBanner } from './components/OfflinePage';
import PayrollPage from './components/PayrollPage';
import HealthCertificatesPage from './components/HealthCertificatesPage';
import HRDocumentsPage from './components/HRDocumentsPage';
import { Footer, HeaderOrnaments } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { db, auth, onAuthStateChanged } from './firebase';
import { Fingerprint, FileText, ChevronLeft, Clock, Users, Building2, Settings, Briefcase, MapPin, LogOut, FileSearch, PieChart, ClipboardList, MinusCircle, Banknote, BarChart3, Shield, CalendarDays } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { saveToLocal, getFromLocal } from './lib/localStorage';

type ViewState = 'dashboard' | 'attendance-menu' | 'hr-menu' | 'departments-menu' | 'fingerprint-analysis' | 'view-edit-fingerprint' | 'reports' | 'settings' | 'hr-documents-menu' | 'job-receipt' | 'social-status-form' | 'employment-contract' | 'form-s1' | 'form-s2' | 'form-s6' | 'employees' | 'deductions' | 'payroll' | 'statistics' | 'notifications' | 'health-certificates' | 'leaves';

interface AuthUser {
  name: string;
  username: string;
  jobTitle: string;
  role?: 'admin' | 'hr' | 'viewer';
  allowedPages?: string[];
}

const ROLE_PAGES: Record<string, string[]> = {
  admin: ['attendance', 'hr', 'settings', 'statistics', 'notifications'],
  hr: ['attendance', 'hr', 'statistics', 'notifications'],
  viewer: ['statistics', 'notifications'],
};

// Map between ViewState and URL hash
const VIEW_TO_HASH: Record<string, string> = {
  'dashboard': '#/',
  'attendance-menu': '#/attendance',
  'hr-menu': '#/hr',
  'hr-documents-menu': '#/hr/documents',
  'employment-contract': '#/hr/documents/contract',
  'fingerprint-analysis': '#/attendance/fingerprint',
  'view-edit-fingerprint': '#/attendance/fingerprint/edit',
  'reports': '#/attendance/reports',
  'employees': '#/hr/employees',
  'deductions': '#/attendance/deductions',
  'payroll': '#/attendance/payroll',
  'statistics': '#/statistics',
  'notifications': '#/notifications',
  'leaves': '#/hr/leaves',
  'health-certificates': '#/health-certificates',
  'settings': '#/settings',
};

const HASH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_HASH).map(([k, v]) => [v, k])
);

function getViewFromHash(): string {
  const hash = window.location.hash || '#/';
  return HASH_TO_VIEW[hash] || 'dashboard';
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>(() => getViewFromHash() as ViewState);
  const [time, setTime] = useState(new Date());
  const [user, setUser] = useState<AuthUser | null>(null);

  // Sync hash → view (browser back/forward)
  useEffect(() => {
    const onHashChange = () => {
      const view = getViewFromHash() as ViewState;
      setCurrentView(view);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Navigate: update state AND push hash to browser history
  const navigate = (view: ViewState) => {
    const hash = VIEW_TO_HASH[view] || '#/';
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
    }
    setCurrentView(view);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    ensureSuperUser();
    
    // Check session storage for existing login
    const savedUser = sessionStorage.getItem('hr_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      // If Firebase is logged in but local state is empty (e.g. refresh after Google Login)
      if (fbUser && !user) {
        const savedUser = sessionStorage.getItem('hr_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }
    });
    return () => unsubscribeAuth();
  }, [user]);

  const ensureSuperUser = async () => {
    try {
      const users = getFromLocal('system_users') || [];
      const superUser = users.find((u: any) => u.username === '123');
      
      if (!superUser) {
        const newSuperUser = {
          name: 'ابانوب متواضع',
          jobTitle: 'HR',
          username: '123',
          password: '123',
          isSuperUser: true,
          createdAt: new Date().toISOString()
        };
        saveToLocal('system_users', [...users, newSuperUser]);
      }
    } catch (e) {
      console.error("Error ensuring superuser (local):", e);
    }
  };

  const handleLogin = (userData: AuthUser) => {
    setUser(userData);
    sessionStorage.setItem('hr_user', JSON.stringify(userData));
    logActivity(db, 'تسجيل دخول', `قام ${userData.name} بتسجيل الدخول للنظام`, userData.name, 'login');
  };

  const handleLogout = () => {
    setUser(null);
    if (user) logActivity(db, 'تسجيل خروج', `قام ${user.name} بتسجيل الخروج من النظام`, user.name || 'مستخدم', 'login');
    sessionStorage.removeItem('hr_user');
    window.history.replaceState(null, '', '#/login');
    navigate('dashboard');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const hasAccess = (pageId: string) => {
    if (!user) return false;
    // Superuser always has full access
    if (user.username === '123' || user.username === 'admin') return true;
    // Role-based access
    if (user.role && ROLE_PAGES[user.role]) return ROLE_PAGES[user.role].includes(pageId);
    // Fallback to allowedPages
    if (!user.allowedPages || user.allowedPages.length === 0) return true;
    return user.allowedPages.includes(pageId);
  };

  const canEdit = () => {
    if (!user) return false;
    if (user.username === '123' || user.username === 'admin') return true;
    return user.role === 'admin' || user.role === 'hr';
  };

  const renderTabletHeader = (title?: string, onBack?: () => void) => (
    <div className="w-full flex items-center justify-between p-6 text-[#3a2a1f] z-10 relative">
      <HeaderOrnaments />
      <div className="w-1/3 relative z-10">
        {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-xl font-bold hover:text-[#76151e] transition-colors bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm">
            <ChevronLeft size={30} />
            <span>رجوع</span>
          </button>
        )}
      </div>
      <div className="w-1/3 text-center relative z-10">
        {title && <h1 className="text-2xl font-bold text-[#3a2a1f]">{title}</h1>}
      </div>
      <div className="w-1/3 flex justify-end items-center gap-4 text-sm font-bold opacity-70 relative z-10">
        <div className="flex flex-col items-end">
          <span>{formatTime(time)}</span>
          <span className="text-[10px]">{formatDate(time).split(',')[0]}</span>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] text-stone-900 font-sans relative bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      {/* Decorative background blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      <header className="w-full flex items-start justify-between p-6 z-20 relative">
        <HeaderOrnaments />
        <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md px-5 py-3 rounded-full shadow-sm border border-white/60 relative z-10">
          <div className="w-10 h-10 rounded-full bg-[#76151e] text-white flex items-center justify-center font-bold">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#3a2a1f]">{user?.name}</span>
            <span className="text-[10px] text-[#7a6a5f]">{user?.jobTitle}</span>
          </div>
        </div>
        
        {/* Logo at the top center */}
        <div className="flex-1 flex justify-center relative z-10">
          <img 
            src="https://up6.cc/2026/03/177489580765681.png" 
            alt="Horloge HR Logo" 
            className="h-[80px] sm:h-[120px] object-contain drop-shadow-md -mt-4" 
            referrerPolicy="no-referrer" 
          />
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-[#76151e] font-bold bg-white/40 hover:bg-[#76151e] hover:text-white backdrop-blur-md px-5 py-3 rounded-full shadow-sm border border-white/60 transition-all group shrink-0 relative z-10"
        >
          <LogOut size={25} />
          <span>خروج</span>
        </button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col items-center pt-8 z-10 relative">
        {/* Clock & Date Horizontal Bar */}
        <div className="flex flex-col items-center gap-1 mb-6 sm:mb-8">
          <div className="text-xl sm:text-2xl font-bold text-[#7a6a5f]">
            {formatDate(time)}
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-[#3a2a1f] tracking-tight" dir="ltr">
            {formatTime(time)}
          </div>
        </div>

        {/* Welcome Message */}
        <p className="text-center font-bold text-lg sm:text-xl text-[#3a2a1f] mb-8">
            اهلا بك يا {user?.name}، أنت مسجل لدينا بوظيفة {user?.jobTitle}
        </p>

        {/* App Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-12 sm:gap-y-14 justify-items-center w-full px-4">
          {/* App 1: Attendance */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('attendance-menu')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Clock size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الحضور والانصراف</span>
            </button>
          )}

          {/* App 2: HR */}
          {hasAccess('hr') && (
            <button 
              onClick={() => navigate('hr-menu')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Users size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">شؤون الموظفين</span>
            </button>
          )}

          {/* App: Health Certificates */}
          {hasAccess('hr') && (
            <button 
              onClick={() => navigate('health-certificates')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Shield size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الشهادات الصحية</span>
            </button>
          )}

          {/* App 3: Settings */}
          {hasAccess('settings') && (
            <button 
              onClick={() => navigate('settings')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Settings size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الإعدادات</span>
            </button>
          )}

          {/* App 4: Statistics */}
          <button 
            onClick={() => navigate('statistics')}
            className="flex flex-col items-center gap-3 group w-20 sm:w-24"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
              <BarChart3 size={32} strokeWidth={1.5} />
            </div>
            <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الإحصائيات</span>
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  const renderAttendanceMenu = () => (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] text-stone-900 font-sans relative bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {renderTabletHeader('الحضور والانصراف', () => navigate('dashboard'))}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col items-center pt-4 z-10 relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-12 sm:gap-y-14 justify-items-center w-full px-4">
          {/* App 1: Fingerprint Analysis */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('fingerprint-analysis')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Fingerprint size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">اضافة بصمة</span>
            </button>
          )}

          {/* App 2: View/Edit Fingerprint */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('view-edit-fingerprint')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <FileSearch size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">عرض / تعديل بصمة</span>
            </button>
          )}

          {/* App: Deductions */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('deductions')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <MinusCircle size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الخصومات والجزاءات</span>
            </button>
          )}

          {/* App: Payroll */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('payroll')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <Banknote size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">بي رول</span>
            </button>
          )}

          {/* App 3: Reports */}
          {hasAccess('attendance') && (
            <button 
              onClick={() => navigate('reports')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <PieChart size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">تقارير البصمة</span>
            </button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );

  const renderHRMenu = () => (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] text-stone-900 font-sans relative bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {renderTabletHeader('شؤون الموظفين', () => navigate('dashboard'))}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col items-center pt-4 z-10 relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-12 sm:gap-y-14 justify-items-center w-full px-4">
          {hasAccess('hr') && (
            <button 
              onClick={() => navigate('employees')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24 opacity-80"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <ClipboardList size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">قائمة الموظفين</span>
            </button>
          )}

          {hasAccess('hr') && (
            <button 
              onClick={() => navigate('hr-documents-menu')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24 opacity-80"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <FileText size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">ورق HR</span>
            </button>
          )}

          {hasAccess('hr') && (
            <button 
              onClick={() => navigate('leaves')}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24 opacity-80"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <CalendarDays size={32} strokeWidth={1.5} />
              </div>
              <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">الإجازات</span>
            </button>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );

  const renderHRDocumentsMenu = () => (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] text-stone-900 font-sans relative bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {renderTabletHeader('ورق HR', () => navigate('hr-menu'))}

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col items-center pt-4 z-10 relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-12 sm:gap-y-14 justify-items-center w-full px-4">
          <button 
            onClick={() => navigate('employment-contract')}
            className="flex flex-col items-center gap-3 group w-20 sm:w-24 opacity-80"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
              <FileText size={32} strokeWidth={1.5} />
            </div>
            <span className="text-sm sm:text-base font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">عقد عمل</span>
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  const renderReportsUnderConstruction = () => (
    <div dir="rtl" className="flex-1 flex flex-col bg-[#e6e1d6] text-stone-900 font-sans relative bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      {renderTabletHeader('تحت الإنشاء', () => navigate('attendance-menu'))}

      <main className="flex-grow overflow-y-auto flex items-center justify-center px-6 pb-20 z-10 relative">
        <div className="bg-[#e0dcd0]/80 backdrop-blur-xl rounded-[2.5rem] p-10 sm:p-14 shadow-2xl border border-white/60 flex flex-col items-center text-center max-w-lg w-full">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[2rem] bg-[#76151e] text-white flex items-center justify-center mb-8 shadow-inner">
            <PieChart size={32} strokeWidth={1.5} />
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#3a2a1f] mb-4">تحت الإنشاء</h2>
          <p className="text-[#7a6a5f] text-xl sm:text-2xl mb-10 leading-relaxed">
            نحن نعمل حالياً على تطوير هذه الصفحة المتقدمة. ستكون متاحة قريباً!
          </p>
          <button 
            onClick={() => navigate('attendance-menu')}
            className="bg-[#3a2a1f] hover:bg-[#1a120c] text-white px-8 py-4 rounded-full font-bold text-xl shadow-lg hover:shadow-xl transition-all w-full"
          >
            العودة للقائمة السابقة
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );

  const renderViewEditFingerprint = () => (
    <ViewEditFingerprint onBack={() => navigate('attendance-menu')} canEdit={canEdit()} />
  );

  const renderReports = () => (
    <ReportsView onBack={() => navigate('attendance-menu')} />
  );

  const renderSettings = () => (
    <SettingsView onBack={() => navigate('dashboard')} />
  );

  return (
    <ToastProvider>
      <OfflineBanner />
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <FirebaseMigration />
          {(() => {
            switch (currentView) {
            case 'dashboard': return renderDashboard();
            case 'attendance-menu': return renderAttendanceMenu();
            case 'hr-menu': return renderHRMenu();
            case 'hr-documents-menu': return <ErrorBoundary onBack={() => navigate('hr-menu')} pageName="ورق HR"><HRDocumentsPage onBack={() => navigate('hr-menu')} /></ErrorBoundary>;
            case 'employment-contract': return <ErrorBoundary onBack={() => navigate('hr-documents-menu')} pageName="عقد العمل"><EmploymentContractPage onBack={() => navigate('hr-documents-menu')} /></ErrorBoundary>;
            case 'fingerprint-analysis': return <ErrorBoundary onBack={() => navigate('attendance-menu')} pageName="البصمة"><FingerprintAnalysis onBack={() => navigate('attendance-menu')} canEdit={canEdit()} /></ErrorBoundary>;
            case 'view-edit-fingerprint': return <ErrorBoundary onBack={() => navigate('attendance-menu')} pageName="تعديل البصمة">{renderViewEditFingerprint()}</ErrorBoundary>;
            case 'reports': return <ErrorBoundary onBack={() => navigate('attendance-menu')} pageName="التقارير">{renderReports()}</ErrorBoundary>;
            case 'employees': return <ErrorBoundary onBack={() => navigate('hr-menu')} pageName="قائمة الموظفين"><EmployeeListPage onBack={() => navigate('hr-menu')} userFallback={user} canEdit={canEdit()} /></ErrorBoundary>;
            case 'deductions': return <ErrorBoundary onBack={() => navigate('attendance-menu')} pageName="الخصومات"><DeductionsPage onBack={() => navigate('attendance-menu')} canEdit={canEdit()} /></ErrorBoundary>;
            case 'statistics': return <ErrorBoundary onBack={() => navigate('dashboard')} pageName="الإحصائيات"><StatisticsPage onBack={() => navigate('dashboard')} /></ErrorBoundary>;
            case 'notifications': return <ErrorBoundary onBack={() => navigate('dashboard')} pageName="الإشعارات"><NotificationsPage onBack={() => navigate('dashboard')} /></ErrorBoundary>;
            case 'payroll': return <ErrorBoundary onBack={() => navigate('attendance-menu')} pageName="بي رول"><PayrollPage onBack={() => navigate('attendance-menu')} canEdit={canEdit()} /></ErrorBoundary>;
            case 'health-certificates': return <ErrorBoundary onBack={() => navigate('dashboard')} pageName="الشهادات الصحية"><HealthCertificatesPage onBack={() => navigate('dashboard')} /></ErrorBoundary>;
            case 'leaves': return <ErrorBoundary onBack={() => navigate('hr-menu')} pageName="الإجازات"><LeavesPage onBack={() => navigate('hr-menu')} /></ErrorBoundary>;
            case 'settings': return <ErrorBoundary onBack={() => navigate('dashboard')} pageName="الإعدادات">{renderSettings()}</ErrorBoundary>;
            default: return renderDashboard();
          }
        })()}
        </>
      )}
    </ToastProvider>
  );
}
