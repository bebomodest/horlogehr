import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, title, message, confirmLabel = 'تأكيد الحذف',
  cancelLabel = 'إلغاء', type = 'danger', onConfirm, onCancel
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#e0dcd0] rounded-3xl p-8 shadow-2xl w-full max-w-sm border border-white/60 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${type === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
            {type === 'danger'
              ? <Trash2 size={28} className="text-red-600" />
              : <AlertTriangle size={28} className="text-amber-600" />
            }
          </div>
          <h3 className="text-xl font-black text-[#3a2a1f] mb-2">{title}</h3>
          <p className="text-[#7a6a5f] font-bold text-sm mb-6 leading-relaxed">{message}</p>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl font-bold text-[#5a4a3f] bg-white/60 border border-[#d4c4b7] hover:bg-white transition-all">
              {cancelLabel}
            </button>
            <button onClick={onConfirm}
              className={`flex-1 py-3 rounded-2xl font-bold text-white transition-all shadow-lg ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
