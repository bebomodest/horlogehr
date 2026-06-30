// ─── Firestore Chunked File Storage ──────────────────────────────────────
// يقسم الملف لأجزاء 600KB ويحفظها في Firestore → متاحة من أي جهاز

import {
  collection, doc, setDoc, getDocs, deleteDoc, query, orderBy,
} from 'firebase/firestore';

const CHUNK_B64 = 600 * 1024; // 600KB per chunk (base64 chars)

const toBase64 = (buf: ArrayBuffer): string => {
  let s = '';
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
};

const fromBase64 = (b64: string): ArrayBuffer => {
  const s   = atob(b64);
  const u8  = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8.buffer;
};

export const uploadFileChunks = async (
  db: any,
  fileId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<number> => {
  const buf    = await file.arrayBuffer();
  const b64    = toBase64(buf);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_B64) {
    chunks.push(b64.slice(i, i + CHUNK_B64));
  }
  const ref = collection(db, 'hr_files', fileId, 'chunks');
  for (let i = 0; i < chunks.length; i++) {
    await setDoc(doc(ref, String(i).padStart(5, '0')), { data: chunks[i], index: i });
    onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
  }
  return chunks.length;
};

export const downloadFileChunks = async (
  db: any,
  fileId: string,
  mimeType: string
): Promise<Blob> => {
  const snap = await getDocs(query(collection(db, 'hr_files', fileId, 'chunks'), orderBy('index')));
  if (snap.empty) throw new Error('الملف غير موجود في قاعدة البيانات');
  const b64  = snap.docs.map(d => d.data().data as string).join('');
  return new Blob([fromBase64(b64)], { type: mimeType });
};

export const deleteFileChunks = async (db: any, fileId: string): Promise<void> => {
  const snap = await getDocs(collection(db, 'hr_files', fileId, 'chunks'));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
};

// ─── Generic Path Upload/Download/Delete ──────────────────────────────────

export const uploadToPath = async (
  db: any,
  pathSegments: string[],   // e.g. ['resignations','empId','letter']
  file: File,
  onProgress?: (pct: number) => void
): Promise<number> => {
  const buf    = await file.arrayBuffer();
  const b64    = toBase64(buf);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_B64) chunks.push(b64.slice(i, i + CHUNK_B64));
  const { collection: col, doc: d, setDoc: sd } = await import('firebase/firestore');
  const ref = col(db, ...pathSegments, 'chunks') as any;
  for (let i = 0; i < chunks.length; i++) {
    await sd(d(ref, String(i).padStart(5, '0')), { data: chunks[i], index: i });
    onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
  }
  return chunks.length;
};

export const downloadFromPath = async (
  db: any,
  pathSegments: string[],
  mimeType: string
): Promise<Blob> => {
  const { collection: col, query: q, orderBy: ob, getDocs: gd } = await import('firebase/firestore');
  const snap = await gd(q(col(db, ...pathSegments, 'chunks') as any, ob('index')));
  if (snap.empty) throw new Error('الملف غير موجود');
  const b64 = snap.docs.map(x => x.data().data as string).join('');
  return new Blob([fromBase64(b64)], { type: mimeType });
};

export const deleteFromPath = async (db: any, pathSegments: string[]): Promise<void> => {
  const { collection: col, getDocs: gd, deleteDoc: dd } = await import('firebase/firestore');
  const snap = await gd(col(db, ...pathSegments, 'chunks') as any);
  await Promise.all(snap.docs.map(x => dd(x.ref)));
};
