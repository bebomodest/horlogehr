import React, { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, Trash2, Eye, X, Save, User as UserIcon, AlertCircle } from 'lucide-react';
import { db, auth } from '../firebase';
import { useToast } from './Toast';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, limit } from 'firebase/firestore';

interface AppUser {
  id: string;
  name: string;
  jobTitle: string;
  username: string;
  password?: string;
  isSuperUser?: boolean;
  role?: 'admin' | 'hr' | 'viewer';
  allowedPages?: string[];
}

const ROLES = [
  {
    id: 'admin',
    label: 'مدير النظام',
    description: 'كل الصلاحيات - إدارة كاملة',
    color: 'bg-[#76151e] text-white',
    pages: ['attendance', 'hr', 'settings', 'statistics', 'notifications']
  },
  {
    id: 'hr',
    label: 'HR',
    description: 'شؤون الموظفين والبصمات والتقارير',
    color: 'bg-blue-600 text-white',
    pages: ['attendance', 'hr', 'statistics', 'notifications']
  },
  {
    id: 'viewer',
    label: 'مشرف (عرض فقط)',
    description: 'التقارير والإحصائيات فقط',
    color: 'bg-emerald-600 text-white',
    pages: ['statistics', 'notifications']
  },
];

const getRolePages = (role: string) => ROLES.find(r => r.id === role)?.pages || [];

export default function SecuritySettings() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [currentUser, setCurrentUser] = useState<Partial<AppUser>>({});
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Superuser info from requirements
  const SUPER_USER_USERNAME = '123';

  useEffect(() => {
    setStatus('جاري محاولة الاتصال بقاعدة البيانات (Project 003)...');
    
    // Test connection explicitly
    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, '.info', 'connected')).catch(() => {
          // This is a common trick for RTDB, for Firestore we just try a simple get
        });
      } catch (e) {
        console.warn('Connection test notice:', e);
      }
    };
    testConnection();

    const q = query(collection(db, 'system_users'), orderBy('name', 'asc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AppUser[];
        
        // Ensure superuser exists if list is empty or superuser missing
        if (docs.length === 0 || !docs.find(u => u.username === SUPER_USER_USERNAME)) {
          ensureSuperUser();
        }
        
        setUsers(docs);
        setLoading(false);
        setStatus('');
        console.log('Connected to General DB successfully');
      },
      (error) => {
        console.error('Firestore Real-time Error:', error);
        setLoading(false);
        const authInfo = auth.currentUser ? `Signed in as ${auth.currentUser.uid}` : 'Not signed in to Firebase';
        
        if (error.message.includes('permission-denied') || (error as any).code === 'permission-denied') {
          setStatus(`خطأ في الصلاحيات (${authInfo}). يرجى التأكد من ضبط القواعد في Firebase Console لتسمح بالقراءة.`);
        } else if (error.message.includes('offline')) {
          setStatus('يبدو أنك غير متصل بالإنترنت أو أن قاعدة البيانات غير متاحة حالياً.');
        } else {
          setStatus(`فشل الاتصال: ${error.message} (${authInfo})`);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const ensureSuperUser = async () => {
    try {
      const q = query(collection(db, 'system_users'), where('username', '==', SUPER_USER_USERNAME));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('Creating superuser on eg003...');
        await addDoc(collection(db, 'system_users'), {
          name: 'ابانوب متواضع',
          jobTitle: 'HR',
          username: SUPER_USER_USERNAME,
          password: '123',
          isSuperUser: true,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error ensuring superuser (eg003):', error);
      // Don't show status here to avoid flickering with main loader
    }
  };

  const handleSave = async () => {
    // Clear previous status
    setStatus('');

    if (!currentUser.name || !currentUser.jobTitle || !currentUser.username || !currentUser.password) {
      setStatus('تنبيه: يجب ملأ جميع البيانات (الاسم، الوظيفة، اسم المستخدم، الباسورد)');
      return;
    }

    setIsSaving(true);
    setStatus('جاري محاولة الحفظ في قاعدة البيانات (eg003)...');
    
    const timeoutId = setTimeout(() => {
      if (isSaving) {
        setStatus('تنبيه: عملية الحفظ بطيئة جداً. قد يكون هناك مشكلة في الاتصال أو صلاحيات القواعد (Rules).');
      }
    }, 10000);

    try {
      if (modalMode === 'add') {
        // Double check username uniqueness locally first
        if (users.find(u => u.username === currentUser.username)) {
          setStatus('خطأ: اسم المستخدم هذا مستخدم بالفعل من قبل شخص آخر.');
          setIsSaving(false);
          clearTimeout(timeoutId);
          return;
        }

        await addDoc(collection(db, 'system_users'), {
          name: currentUser.name,
          jobTitle: currentUser.jobTitle,
          username: currentUser.username,
          password: currentUser.password,
          isSuperUser: false,
          role: currentUser.role || 'hr',
          allowedPages: getRolePages(currentUser.role || 'hr'),
          createdAt: serverTimestamp()
        });
        setStatus('✅ تم الحفظ بنجاح.');
      } else if (modalMode === 'edit' && currentUser.id) {
        const userRef = doc(db, 'system_users', currentUser.id);
        const { id, ...updateData } = currentUser;
        
        // Prevent editing username of superuser via simple input
        if (updateData.username === SUPER_USER_USERNAME && modalMode === 'edit') {
           // allow it but keep isSuperUser true
           updateData.isSuperUser = true;
        }

        await updateDoc(userRef, {
          ...updateData,
          updatedAt: serverTimestamp()
        });
        setStatus('✅ تم تحديث البيانات بنجاح.');
      }
      
      clearTimeout(timeoutId);
      setTimeout(() => {
        setIsModalOpen(false);
        setCurrentUser({});
        setIsSaving(false);
        setStatus('');
      }, 1500);
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Security Save Error:', error);
      setIsSaving(false);
      
      const authInfo = auth.currentUser ? `Signed in as ${auth.currentUser.uid}` : 'Not signed in to Firebase';
      
      if (error.message.includes('permission-denied') || error.code === 'permission-denied') {
        setStatus(`❌ فشل الصلاحيات (${authInfo}). تأكد من أن قواعد الحماية تسمح بالكتابة لمجموعات البيانات.`);
      } else {
        setStatus(`❌ فشل الحفظ (${error.message}). Auth Status: ${authInfo}`);
      }
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (user.username === SUPER_USER_USERNAME) {
      addToast('لا يمكن مسح هذا المستخدم الرئيسي', 'error');
      return;
    }

    if (window.confirm(`هل أنت متأكد من مسح المستخدم ${user.name}؟`)) {
      try {
        await deleteDoc(doc(db, 'system_users', user.id));
        setStatus('تم مسح المستخدم بنجاح');
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const openModal = (mode: 'add' | 'edit' | 'view', user?: AppUser) => {
    setModalMode(mode);
    setCurrentUser(user ? { ...user, allowedPages: user.allowedPages || [] } : { allowedPages: [] });
    setIsModalOpen(true);
    setStatus('');
  };

  const testAllConnections = async () => {
    setStatus('جاري اختبار جميع القواعد (Rules) للمشاريع الثلاثة...');
    const results = [];
    
    try {
      // Test General (eg003)
      await getDocs(query(collection(db, 'system_users'), limit(1)));
      results.push('✅ مشروع eg003-3e34b (الأمن) متصل');
    } catch (e) {
      results.push('❌ مشروع eg003-3e34b (الأمن) غير متصل - راجع القواعد');
    }

    try {
      // Test Employees (egg001)
      await getDocs(query(collection(db, 'employees'), limit(1)));
      results.push('✅ مشروع egg001-5d7b4 (الموظفين) متصل');
    } catch (e) {
      results.push('❌ مشروع egg001-5d7b4 (الموظفين) غير متصل - راجع القواعد');
    }

    try {
      // Test Fingerprints (eg002)
      await getDocs(query(collection(db, 'fingerprints'), limit(1)));
      results.push('✅ مشروع eg002-11770 (البصمات) متصل');
    } catch (e) {
      results.push('❌ مشروع eg002-11770 (البصمات) غير متصل - راجع القواعد');
    }

    addToast(results[0] || 'تم الحفظ', results.some(r => r.includes('خطأ')) ? 'error' : 'success');
    setStatus('');
  };

  return (
    <div dir="rtl" className="w-full">
      <div className="flex justify-between items-center mb-8 bg-white/30 p-4 rounded-2xl border border-white/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#76151e] text-white rounded-2xl shadow-lg">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#3a2a1f]">إدارة المستخدمين</h2>
            <p className="text-[#7a6a5f] text-sm italic">إدارة صلاحيات مستخدمين النظام</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => openModal('add')}
            className="bg-[#76151e] text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg hover:bg-[#8a1923] transition-all"
          >
            <Plus size={20} />
            إضافة مستخدم
          </button>
        </div>
      </div>

      {status && !isModalOpen && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-pulse ${status.includes('خطأ') ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
          <AlertCircle size={20} />
          <p className="font-bold text-sm">{status}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#7a6a5f] gap-4">
          <div className="w-10 h-10 border-4 border-[#76151e]/20 border-t-[#76151e] rounded-full animate-spin"></div>
          <p className="animate-pulse font-medium">جاري تحديث البيانات...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.length === 0 && !status && (
            <div className="py-20 text-center bg-white/30 rounded-[2.5rem] border border-dashed border-[#d4c4b7]">
              <div className="w-16 h-16 bg-[#76151e]/5 text-[#76151e]/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserIcon size={32} />
              </div>
              <p className="text-[#7a6a5f] italic">لا يوجد مستخدمين مسجلين حالياً</p>
            </div>
          )}
          {users.map(user => (
            <div key={user.id} className="bg-white/40 backdrop-blur-sm p-5 rounded-[1.5rem] shadow-sm border border-white/60 flex items-center justify-between hover:bg-white/60 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#76151e]/10 text-[#76151e] flex items-center justify-center">
                  <UserIcon size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[#3a2a1f]">{user.name}</h3>
                    {user.role && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        user.role === 'admin' ? 'bg-[#76151e]/10 text-[#76151e]' :
                        user.role === 'hr' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {ROLES.find(r => r.id === user.role)?.label || user.role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7a6a5f]">{user.jobTitle}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => openModal('view', user)}
                  className="p-2.5 bg-white/80 rounded-full text-[#7a6a5f] hover:bg-[#76151e] hover:text-white transition-all shadow-sm"
                  title="عرض"
                >
                  <Eye size={18} />
                </button>
                <button 
                  onClick={() => openModal('edit', user)}
                  className="p-2.5 bg-white/80 rounded-full text-[#7a6a5f] hover:bg-[#76151e] hover:text-white transition-all shadow-sm"
                  title="تعديل"
                >
                  <Pencil size={18} />
                </button>
                {user.username !== SUPER_USER_USERNAME && (
                  <button 
                    onClick={() => handleDelete(user)}
                    className="p-2.5 bg-white/80 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    title="مسح"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-[#f2efe9] rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white flex flex-col">
            <div className="bg-[#76151e] p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {modalMode === 'add' ? 'إضافة مستخدم جديد' : modalMode === 'edit' ? 'تعديل بيانات المستخدم' : 'بيانات المستخدم'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label="إغلاق"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-2 mr-2 leading-none">اسم الموظف</label>
                  <input 
                    type="text" 
                    value={currentUser.name || ''}
                    disabled={modalMode === 'view'}
                    onChange={(e) => setCurrentUser({...currentUser, name: e.target.value})}
                    className="w-full bg-white/80 border border-[#d4c4b7] rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-2 mr-2 leading-none">الوظيفة</label>
                  <input 
                    type="text" 
                    value={currentUser.jobTitle || ''}
                    disabled={modalMode === 'view'}
                    onChange={(e) => setCurrentUser({...currentUser, jobTitle: e.target.value})}
                    className="w-full bg-white/80 border border-[#d4c4b7] rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-2 mr-2 leading-none">اسم المستخدم</label>
                  <input 
                    type="text" 
                    value={currentUser.username || ''}
                    disabled={modalMode === 'view' || (modalMode === 'edit' && currentUser.username === SUPER_USER_USERNAME)}
                    onChange={(e) => setCurrentUser({...currentUser, username: e.target.value})}
                    className="w-full bg-white/80 border border-[#d4c4b7] rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-2 mr-2 leading-none">الرقم السرى</label>
                  <input 
                    type={modalMode === 'view' ? "text" : "password"} 
                    value={currentUser.password || ''}
                    disabled={modalMode === 'view'}
                    onChange={(e) => setCurrentUser({...currentUser, password: e.target.value})}
                    className="w-full bg-white/80 border border-[#d4c4b7] rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all disabled:opacity-60"
                  />
                </div>
                
                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-bold text-[#3a2a1f] mb-3">الدور والصلاحيات</label>
                  <div className="grid grid-cols-1 gap-3">
                    {ROLES.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        disabled={modalMode === 'view'}
                        onClick={() => {
                          if (modalMode === 'view') return;
                          setCurrentUser(prev => ({
                            ...prev,
                            role: role.id as 'admin' | 'hr' | 'viewer',
                            allowedPages: getRolePages(role.id)
                          }));
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-right ${
                          currentUser.role === role.id
                            ? 'border-[#76151e] bg-[#76151e]/5 shadow-md'
                            : 'border-[#e6dfd3] bg-white/60 hover:bg-white/80'
                        } disabled:cursor-default`}
                      >
                        <div className={`w-10 h-10 rounded-xl ${role.color} flex items-center justify-center font-black text-sm shrink-0`}>
                          {role.id === 'admin' ? '👑' : role.id === 'hr' ? '👔' : '👁️'}
                        </div>
                        <div className="flex-1 text-right">
                          <p className={`font-bold text-sm ${currentUser.role === role.id ? 'text-[#76151e]' : 'text-[#3a2a1f]'}`}>{role.label}</p>
                          <p className="text-xs text-[#7a6a5f] mt-0.5">{role.description}</p>
                        </div>
                        {currentUser.role === role.id && (
                          <div className="w-5 h-5 rounded-full bg-[#76151e] flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {status && (
                <div className={`mt-6 p-4 rounded-xl text-center font-bold text-sm ${status.includes('نجاح') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {status}
                </div>
              )}
            </div>

            {modalMode !== 'view' && (
              <div className="p-6 bg-white/40 border-t border-[#d4c4b7] flex justify-end">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#76151e] text-white px-10 py-3.5 rounded-full font-bold flex items-center gap-2 shadow-lg hover:bg-[#8a1923] transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : <Save size={20} />}
                  <span>{isSaving ? 'جاري الحفظ...' : 'حفظ البيانات'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
