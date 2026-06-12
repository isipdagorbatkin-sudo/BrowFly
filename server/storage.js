import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const bucket = 'browfly-uploads';
let supabase = null;
let bucketReady = false;

function useSupabaseStorage() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabase;
}

async function ensureBucket() {
  if (!useSupabaseStorage() || bucketReady) return;

  const client = getSupabase();
  const { error } = await client.storage.createBucket(bucket, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    fileSizeLimit: 5 * 1024 * 1024
  });

  if (error && !String(error.message).toLowerCase().includes('already exists')) {
    throw error;
  }

  bucketReady = true;
}

export function makeUploadMiddleware(multer) {
  return useSupabaseStorage()
    ? multer({ storage: multer.memoryStorage() })
    : multer({
        storage: multer.diskStorage({
          destination: path.join(process.cwd(), 'uploads'),
          filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname || '.jpg');
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
          }
        })
      });
}

export async function saveUpload(file) {
  if (!useSupabaseStorage()) {
    return `/uploads/${file.filename}`;
  }

  await ensureBucket();
  const ext = path.extname(file.originalname || '.jpg') || '.jpg';
  const objectPath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${ext}`;

  const { error } = await getSupabase()
    .storage
    .from(bucket)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw error;

  const { data } = getSupabase().storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

export function ensureLocalUploadsDir() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}
