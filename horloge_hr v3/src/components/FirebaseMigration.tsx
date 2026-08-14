import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFromLocal, saveToLocal } from '../lib/localStorage';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FirebaseMigration() {
  const [status, setStatus] = useState<'idle' | 'migrating' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const isMigrated = localStorage.getItem('firebase_migrated');
        if (!isMigrated) {
          startMigration(user.uid);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const startMigration = async (uid: string) => {
    const localEmployees = getFromLocal('employees');
    const localFingerprints = getFromLocal('fingerprints'); // Adjust key if needed

    if (localEmployees.length === 0 && localFingerprints.length === 0) {
      localStorage.setItem('firebase_migrated', 'true');
      return;
    }

    setStatus('migrating');
    const total = localEmployees.length + localFingerprints.length;
    setProgress({ current: 0, total });
    let count = 0;

    try {
      // Migrate Employees
      for (const emp of localEmployees) {
        setMessage(`جاري نقل الموظف: ${emp.name}`);
        const empId = emp.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await setDoc(doc(db, 'employees', empId), {
          ...emp,
          uid,
          updatedAt: serverTimestamp()
        }, { merge: true });
        count++;
        setProgress({ current: count, total });
      }

      // Migrate Fingerprints (if any)
      for (const fp of localFingerprints) {
        setMessage(`جاري نقل سجلات البصمة...`);
        const fpId = fp.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await setDoc(doc(db, 'fingerprints', fpId), {
          ...fp,
          uid,
          updatedAt: serverTimestamp()
        }, { merge: true });
        count++;
        setProgress({ current: count, total });
      }

      setStatus('completed');
      localStorage.setItem('firebase_migrated', 'true');
      setMessage('تمت مزامنة البيانات المحلية مع السحابة بنجاح');
    } catch (error) {
      console.error('Migration error:', error);
      setStatus('error');
      setMessage('حدث خطأ أثناء مزامنة البيانات');
    }
  };

  if (status === 'idle') return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white rounded-3xl shadow-2xl p-6 border border-stone-200 flex items-center gap-4 max-w-md backdrop-blur-md bg-white/90">
        {status === 'migrating' && (
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-[#76151e]" size={24} />
            <div>
              <p className="font-bold text-sm text-[#3a2a1f]">{message}</p>
              <p className="text-[10px] text-[#7a6a5f]">جاري المزامنة ({progress.current}/{progress.total})</p>
            </div>
          </div>
        )}
        {status === 'completed' && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-green-600" size={24} />
            <div>
              <p className="font-bold text-sm text-green-700">{message}</p>
              <button 
                onClick={() => setStatus('idle')}
                className="text-[10px] text-[#7a6a5f] hover:underline"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600" size={24} />
            <div>
              <p className="font-bold text-sm text-red-700">{message}</p>
              <button 
                onClick={() => setStatus('idle')}
                className="text-[10px] text-[#7a6a5f] hover:underline"
              >
                تجاهل
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
