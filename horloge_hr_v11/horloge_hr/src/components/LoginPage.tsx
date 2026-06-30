import React, { useState } from 'react';
import { getFromLocal } from '../lib/localStorage';
import { User, Lock, LogIn, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Footer } from './Footer';

interface LoginPageProps {
  onLogin: (user: { name: string; username: string; jobTitle: string; allowedPages?: string[] }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('برجاء ادخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Try local storage as fallback
        let users = getFromLocal('system_users') || [];
        
        // Try Firestore directly (no auth required - update firestore.rules to allow public read on system_users)
        try {
          const snapshot = await getDocs(collection(db, 'system_users'));
          if (!snapshot.empty) {
            users = snapshot.docs.map(doc => doc.data());
          }
        } catch (e) {
          console.warn('Could not fetch users from Firestore, using local fallback.', e);
        }

        const userData = users.find((u: any) => u.username === trimmedUsername);
        
        let authenticatedUser = null;

        if (userData) {
            if (userData.password === trimmedPassword) {
                authenticatedUser = {
                    name: userData.name,
                    username: userData.username,
                    jobTitle: userData.jobTitle,
                    role: userData.role || 'hr',
                    allowedPages: userData.allowedPages || []
                };
            } else {
                setError('كلمة المرور غير صحيحة');
                setLoading(false);
                return;
            }
        } else if ((trimmedUsername === 'admin' && trimmedPassword === 'admin') || (trimmedUsername === '123' && trimmedPassword === '123')) {
            authenticatedUser = {
                name: trimmedUsername === '123' ? 'ابانوب متواضع' : 'مسؤول النظام (افتراضي)',
                username: trimmedUsername,
                jobTitle: 'HR',
                role: 'admin',
                allowedPages: ['attendance', 'hr', 'settings', 'statistics', 'notifications']
            };
        } else {
            setError('اسم المستخدم غير موجود');
            setLoading(false);
            return;
        }

        if (authenticatedUser) {
            onLogin(authenticatedUser);
        }

    } catch (err: any) {
      console.error('Login error:', err);
      setError('حدث خطأ فني - يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-[#e6e1d6] font-sans flex flex-col bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="flex-1 flex items-center justify-center p-6">

      <div className="bg-[#e0dcd0]/80 backdrop-blur-xl rounded-[3rem] p-10 sm:p-14 shadow-2xl border border-white/60 flex flex-col items-center max-w-md w-full relative z-10">
        <div className="mb-10 flex justify-center w-full">
          <img 
            src="https://up6.cc/2026/03/177489580765681.png" 
            alt="Horloge HR Logo" 
            className="h-28 sm:h-36 object-contain drop-shadow-md" 
            referrerPolicy="no-referrer" 
          />
        </div>

        <h1 className="text-2xl font-bold text-[#3a2a1f] mb-8">تسجيل الدخول للنظام</h1>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none text-[#7a6a5f]">
              <User size={20} />
            </div>
            <input 
              type="text" 
              placeholder="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/60 border border-[#d4c4b7] rounded-2xl pr-12 pl-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all text-lg"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none text-[#7a6a5f]">
              <Lock size={20} />
            </div>
            <input 
              type="password" 
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/60 border border-[#d4c4b7] rounded-2xl pr-12 pl-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#76151e] transition-all text-lg"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-100 p-4 rounded-xl text-sm font-bold animate-pulse">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#76151e] hover:bg-[#8a1923] text-white py-4 rounded-2xl font-bold text-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={24} />
                <span>دخول</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-xs text-[#7a6a5f] italic">
          Horloge HR © 2026 - جميع الحقوق محفوظة
        </p>
      </div>
      </div>
      <Footer />
    </div>
  );
}
