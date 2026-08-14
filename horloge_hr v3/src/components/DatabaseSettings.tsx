import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, CheckCircle2, AlertCircle, Save, Settings, Info } from 'lucide-react';
import { getDatabases, saveDatabases, DatabaseEntry, FirebaseConfig } from '../lib/databaseManager';

const PAGE_OPTIONS = [
  { id: 'fingerprint-analysis', label: 'اضافة بصمة' },
  { id: 'reports', label: 'تقارير البصمة' },
  { id: 'hr', label: 'شؤون الموظفين' },
  { id: 'leaves', label: 'الإجازات' },
  { id: 'departments', label: 'الأقسام' },
];

export default function DatabaseSettings() {
  const { addToast } = useToast();
  const [databases, setDatabases] = useState<DatabaseEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDb, setNewDb] = useState<Partial<DatabaseEntry>>({
    name: '',
    config: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      measurementId: '',
      databaseId: '',
    },
    activePages: [],
  });

  useEffect(() => {
    setDatabases(getDatabases());
  }, []);

  const handleSave = () => {
    if (!newDb.name || !newDb.config?.apiKey || !newDb.config?.projectId || !newDb.config?.appId) {
      addToast('يرجى ملء الحقول الأساسية', 'error');
      return;
    }

    const entry: DatabaseEntry = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDb.name!,
      config: newDb.config as FirebaseConfig,
      activePages: newDb.activePages || [],
    };

    const updated = [...databases, entry];
    setDatabases(updated);
    saveDatabases(updated);
    setIsAdding(false);
    setNewDb({
      name: '',
      config: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
        databaseId: '',
      },
      activePages: [],
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه القاعدة؟')) {
      const updated = databases.filter(db => db.id !== id);
      setDatabases(updated);
      saveDatabases(updated);
    }
  };

  const togglePage = (pageId: string) => {
    const currentPages = newDb.activePages || [];
    if (currentPages.includes(pageId)) {
      setNewDb({ ...newDb, activePages: currentPages.filter(p => p !== pageId) });
    } else {
      setNewDb({ ...newDb, activePages: [...currentPages, pageId] });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#76151e]/10 text-[#76151e] flex items-center justify-center">
            <Database size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#3a2a1f]">قواعد البيانات</h2>
            <p className="text-[#7a6a5f]">إدارة وربط الموقع بقواعد بيانات Firebase الخارجية.</p>
          </div>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-[#76151e] hover:bg-[#8a1923] text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all"
          >
            <Plus size={20} />
            <span>إضافة قاعدة جديدة</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white/80 rounded-3xl p-8 border border-[#76151e]/20 shadow-inner flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">اسم القاعدة</label>
              <input
                type="text"
                value={newDb.name}
                onChange={(e) => setNewDb({ ...newDb, name: e.target.value })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
                placeholder="مثال: قاعدة بيانات الفرع الرئيسي"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">API Key</label>
              <input
                type="text"
                value={newDb.config?.apiKey}
                onChange={(e) => setNewDb({ ...newDb, config: { ...newDb.config!, apiKey: e.target.value } })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">Project ID</label>
              <input
                type="text"
                value={newDb.config?.projectId}
                onChange={(e) => setNewDb({ ...newDb, config: { ...newDb.config!, projectId: e.target.value } })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">App ID</label>
              <input
                type="text"
                value={newDb.config?.appId}
                onChange={(e) => setNewDb({ ...newDb, config: { ...newDb.config!, appId: e.target.value } })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">Auth Domain</label>
              <input
                type="text"
                value={newDb.config?.authDomain}
                onChange={(e) => setNewDb({ ...newDb, config: { ...newDb.config!, authDomain: e.target.value } })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-[#3a2a1f] mr-2">Database ID (اختياري)</label>
              <input
                type="text"
                value={newDb.config?.databaseId}
                onChange={(e) => setNewDb({ ...newDb, config: { ...newDb.config!, databaseId: e.target.value } })}
                className="bg-white border border-[#d4c4b7] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#76151e]/50"
                placeholder="(default)"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-sm font-bold text-[#3a2a1f] mr-2">الصفحات المسؤولة عنها هذه القاعدة:</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PAGE_OPTIONS.map((page) => (
                <button
                  key={page.id}
                  onClick={() => togglePage(page.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    newDb.activePages?.includes(page.id)
                      ? 'bg-[#76151e] text-white border-[#76151e] shadow-md'
                      : 'bg-white text-[#3a2a1f] border-[#d4c4b7] hover:border-[#76151e]'
                  }`}
                >
                  {newDb.activePages?.includes(page.id) && <CheckCircle2 size={16} />}
                  <span className="text-sm font-bold">{page.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-[#76151e] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#8a1923] transition-all"
            >
              <Save size={20} />
              <span>حفظ القاعدة</span>
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-8 py-4 rounded-2xl font-bold text-[#7a6a5f] hover:bg-white/40 transition-all"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-[#3a2a1f] mr-2">القواعد الحالية</h3>
        {databases.length === 0 ? (
          <div className="bg-white/40 rounded-3xl p-12 flex flex-col items-center justify-center text-center border border-dashed border-[#d4c4b7]">
            <Info size={40} className="text-[#7a6a5f] mb-4 opacity-40" />
            <p className="text-[#7a6a5f]">لا توجد قواعد بيانات مضافة حالياً. سيتم استخدام القاعدة الافتراضية للموقع.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {databases.map((db) => (
              <div
                key={db.id}
                className="bg-white/80 rounded-3xl p-6 flex items-center justify-between border border-white/60 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#76151e] text-white flex items-center justify-center shadow-lg">
                    <Database size={28} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xl font-bold text-[#3a2a1f]">{db.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#7a6a5f]">Project ID:</span>
                      <span className="text-xs font-mono text-[#3a2a1f]">{db.config.projectId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {db.activePages.map((pageId) => (
                        <span
                          key={pageId}
                          className="bg-[#76151e]/10 text-[#76151e] text-[10px] font-bold px-3 py-1 rounded-full border border-[#76151e]/20"
                        >
                          {PAGE_OPTIONS.find(p => p.id === pageId)?.label || pageId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(db.id)}
                  className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-all"
                  title="حذف"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#76151e]/5 rounded-3xl p-6 flex items-start gap-4 border border-[#76151e]/10">
        <Info className="text-[#76151e] shrink-0 mt-1" size={20} />
        <p className="text-sm text-[#7a6a5f] leading-relaxed">
          عند إضافة قاعدة بيانات جديدة وتخصيص صفحات لها، سيقوم الموقع تلقائياً بالاتصال بهذه القاعدة عند فتح تلك الصفحات. 
          يتم حفظ وعرض البيانات مباشرة من قاعدة البيانات المحددة بدلاً من التخزين المحلي.
        </p>
      </div>
    </div>
  );
}
