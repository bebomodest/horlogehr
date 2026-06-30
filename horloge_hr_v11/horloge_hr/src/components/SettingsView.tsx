import React, { useState } from 'react';
import { ChevronLeft, Database, Settings, Shield, User, Bell } from 'lucide-react';
import DatabaseSettings from './DatabaseSettings';
import SecuritySettings from './SecuritySettings';
import { Footer } from './Footer';

interface SettingsViewProps {
  onBack: () => void;
}

type SettingsSubPage = 'general' | 'databases' | 'security' | 'profile' | 'notifications';

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [activeSubPage, setActiveSubPage] = useState<SettingsSubPage | null>(null);

  const renderTabletHeader = (title: string, onBackClick: () => void) => (
    <div className="w-full flex items-center justify-between p-6 text-[#3a2a1f] z-10 relative">
      <div className="w-1/3">
        <button onClick={onBackClick} className="flex items-center gap-1 text-lg font-bold hover:text-[#76151e] transition-colors bg-white/40 hover:bg-white/60 backdrop-blur-md px-5 py-2.5 rounded-full shadow-sm">
          <ChevronLeft size={24} />
          <span>رجوع</span>
        </button>
      </div>
      <div className="w-1/3 text-center">
        <h1 className="text-2xl font-bold text-[#3a2a1f]">{title}</h1>
      </div>
      <div className="w-1/3 flex justify-end">
      </div>
    </div>
  );

  const menuItems = [
    { id: 'general', label: 'إعدادات عامة', icon: Settings },
    { id: 'databases', label: 'قواعد البيانات', icon: Database },
    { id: 'security', label: 'إدارة المستخدمين', icon: Shield },
    { id: 'profile', label: 'الملف الشخصي', icon: User },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
  ];

  if (activeSubPage) {
    const renderSubPageContent = () => {
      switch (activeSubPage) {
        case 'databases':
          return <DatabaseSettings />;
        case 'security':
          return <SecuritySettings />;
        default:
          return (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 rounded-3xl bg-[#76151e]/10 text-[#76151e] flex items-center justify-center mb-6">
                <Settings size={40} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-[#3a2a1f] mb-2">هذه الصفحة تحت الإنشاء</h2>
              <p className="text-[#7a6a5f]">نحن نعمل على توفير هذه الإعدادات قريباً.</p>
            </div>
          );
      }
    };

    return (
      <div dir="rtl" className="min-h-screen bg-[#e6e1d6] text-stone-900 font-sans relative overflow-x-hidden flex flex-col bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
        <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

        {renderTabletHeader(menuItems.find(m => m.id === activeSubPage)?.label || 'الإعدادات', () => setActiveSubPage(null))}

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 pb-12 z-10 relative">
          <section className="bg-white/60 backdrop-blur-md rounded-[2.5rem] p-8 shadow-xl border border-white/60 min-h-[500px]">
            {renderSubPageContent()}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#e6e1d6] text-stone-900 font-sans relative overflow-x-hidden flex flex-col bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>

      {renderTabletHeader('الإعدادات', onBack)}

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 items-center pt-12 z-10 relative">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-12 sm:gap-y-14 justify-items-center w-full px-4">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveSubPage(item.id as SettingsSubPage)}
              className="flex flex-col items-center gap-3 group w-20 sm:w-24"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.75rem] bg-[#76151e] text-white flex items-center justify-center shadow-lg group-hover:shadow-2xl group-hover:-translate-y-1 transition-all duration-300 border border-white/20">
                <item.icon size={65} strokeWidth={1.5} className="sm:w-10 sm:h-10" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#3a2a1f] text-center leading-tight drop-shadow-sm">{item.label}</span>
            </button>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
