import React, { useState, useEffect } from 'react';
import { Upload, FileText, Plus, Pencil, Printer, X, Save } from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import { db } from './firebase';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

interface Contract {
  id: string;
  name: string;
  data: Record<string, string>;
  fileContent: string;
  // Note: we can't store a File object directly in Firestore easily without Storage. 
  // For now, we'll store the text content.
  uploadDate: string;
  extractedFields: string[];
}

let aiClient: GoogleGenAI | null = null;
const getAiClient = () => {
  if (!aiClient) {
    // Safely check for process environment in case it's not polyfilled on Netlify/Vercel
    let key: string | undefined = undefined;
    try {
      if (typeof process !== 'undefined' && process.env) {
        key = process.env.GEMINI_API_KEY;
      }
    } catch(e) {
      console.warn("process is not defined", e);
    }

    if (!key) {
      console.error('GEMINI_API_KEY environment variable is missing.');
      // return a mock/dummy object that throws on use to prevent crash on load
      return {
        models: {
          generateContent: async () => {
            throw new Error('مفتاح الذكاء الاصطناعي غير متوفر. (GEMINI_API_KEY)');
          }
        }
      } as any;
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

export default function EmploymentContractPage({ onBack }: { onBack: () => void }) {
  const { addToast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [uploadedFile, setUploadedFile] = useState<Partial<Contract> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extractedFields, setExtractedFields] = useState<string[]>([]);
  const [contractData, setContractData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'employment_contracts'), orderBy('uploadDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contract[];
      setContracts(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('جاري التحليل...');
    try {
      let text = '';
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        text = XLSX.utils.sheet_to_txt(sheet);
      } else {
        throw new Error('Unsupported file format');
      }

      text = text.substring(0, 5000);

      // Use Gemini to extract fields
      const prompt = `Extract fillable fields from this document: ${text}. Return only a JSON array of field names.`;
      const response = await getAiClient().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      }).catch(err => {
        console.error('Gemini API Error:', err);
        setStatus('حدث خطأ أثناء تحليل الملف');
        return null;
      });
      
      if (!response) return;
      
      let textResponse = response.text || '[]';
      textResponse = textResponse.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
      
      const fields = JSON.parse(textResponse || '[]');
      setExtractedFields(fields);
      
      const newContract: Partial<Contract> = {
        name: file.name,
        data: {},
        fileContent: text,
        uploadDate: new Date().toLocaleString('ar-EG'),
        extractedFields: fields,
      };
      
      setUploadedFile(newContract);
      setContractData({});
      setStatus('تم رفع وتحليل الملف');
    } catch (error) {
      console.error('File Processing Error:', error);
      setStatus('خطأ: تأكد من رفع ملف docx أو xlsx صالح');
    }
  };

  const handleSaveContract = async () => {
    if (!uploadedFile) return;
    
    // Assume employee name is one of the fields, e.g., 'اسم الموظف'
    const employeeName = contractData['اسم الموظف'] || contractData['الاسم'] || 'عقد جديد';
    
    try {
      if (uploadedFile.id) {
        // Update existing
        const contractRef = doc(db, 'employment_contracts', uploadedFile.id);
        await updateDoc(contractRef, {
          name: employeeName,
          data: contractData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new
        await addDoc(collection(db, 'employment_contracts'), {
          name: employeeName,
          data: contractData,
          fileContent: uploadedFile.fileContent,
          uploadDate: uploadedFile.uploadDate,
          extractedFields: uploadedFile.extractedFields,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setContractData({});
      setUploadedFile(null);
      setStatus('تم حفظ العقد بنجاح');
    } catch (error) {
      console.error('Error saving contract:', error);
      addToast('حدث خطأ أثناء حفظ العقد', 'error');
    }
  };

  const renderFilledContract = (contract: Contract) => {
    let filledContent = contract.fileContent;
    // Simple replacement: try to replace field names with their values
    Object.entries(contract.data).forEach(([field, value]) => {
      const regex = new RegExp(field, 'g');
      filledContent = filledContent.replace(regex, `<span class="bg-yellow-200 font-bold">${value}</span>`);
    });
    return <div className="whitespace-pre-wrap p-6 bg-white rounded-xl shadow-inner font-serif" dangerouslySetInnerHTML={{ __html: filledContent }} />;
  };

  const handleDownload = (contract: Contract) => {
    // Basic text download since we don't store the blob
    const blob = new Blob([contract.fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contract.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = (contract: Contract) => {
    setUploadedFile(contract); // Set as uploaded file for editing
    setContractData(contract.data);
    setExtractedFields(contract.extractedFields);
    setIsModalOpen(true);
  };

  const handlePrint = (contract: Contract) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let filledContent = contract.fileContent;
    Object.entries(contract.data).forEach(([field, value]) => {
      const regex = new RegExp(field, 'g');
      filledContent = filledContent.replace(regex, `<span style="background-color: #fef08a; font-weight: bold;">${value}</span>`);
    });
    
    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: serif; padding: 40px; line-height: 1.6; }
            .highlight { background-color: #fef08a; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${contract.name}</h1>
          <div class="content">${filledContent.replace(/\n/g, '<br>')}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#e6e1d6] text-stone-900 font-sans p-6 relative flex flex-col bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat">
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#76151e] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#8a1923] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="border-4 border-[#3a2a1f] rounded-3xl p-6 min-h-[90vh]">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="bg-white/40 px-5 py-2.5 rounded-full shadow-sm">رجوع</button>
          <h1 className="text-3xl font-bold">عقد عمل</h1>
          <label className="bg-[#76151e] text-white px-6 py-3 rounded-full cursor-pointer flex items-center gap-2">
            <Upload size={20} />
            رفع ملف
            <input type="file" accept=".docx, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </header>

        <p className="text-center text-[#7a6a5f] mb-8">{status}</p>

        {uploadedFile && (
          <div className="bg-white/80 p-6 rounded-2xl shadow-sm mb-8 flex justify-between items-center">
            <div>
              <p className="font-medium">تم رفع ملف: {uploadedFile.name}</p>
              <p className="text-sm text-stone-500">تاريخ الرفع: {uploadedFile.uploadDate}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUploadedFile(null)} className="bg-red-100 text-red-600 px-4 py-2 rounded-full text-sm">مسح</button>
              <button onClick={() => handleDownload(uploadedFile)} className="bg-stone-200 px-4 py-2 rounded-full text-sm">تنزيل</button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {contracts.map(contract => (
            <div key={contract.id} className="bg-white/80 p-4 rounded-xl shadow-sm flex justify-between items-center">
              <span className="font-medium">{contract.name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(contract)} className="p-2 bg-stone-200 rounded-full"><Pencil size={18} /></button>
                <button onClick={() => handlePrint(contract)} className="p-2 bg-stone-200 rounded-full"><Printer size={18} /></button>
              </div>
            </div>
          ))}
        </div>

        {uploadedFile && (
          <button onClick={() => { setContractData({}); setIsModalOpen(true); }} className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#3a2a1f] text-white px-8 py-4 rounded-full flex items-center gap-2 shadow-lg">
            <Plus size={20} />
            إضافة عقد
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">بيانات العقد</h2>
              <button onClick={() => setIsModalOpen(false)}><X /></button>
            </div>
            <div className="overflow-y-auto flex-1 pr-2">
              {(uploadedFile?.extractedFields || []).map(field => (
                <div key={field} className="mb-4">
                  <label className="block mb-1 font-medium">{field}</label>
                  <input 
                    type="text" 
                    value={contractData[field] || ''}
                    onChange={e => setContractData({...contractData, [field]: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              ))}
            </div>
            <button onClick={handleSaveContract} className="w-full bg-[#76151e] text-white py-3 rounded-full mt-4 flex items-center justify-center gap-2">
              <Save size={20} />
              حفظ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
