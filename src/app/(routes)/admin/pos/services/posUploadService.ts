// POS Upload Service - Bank Transfer Screenshot Upload

import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export interface UploadResult {
  url: string;
  originalFilename: string;
  uploadedAt: string;
}

export async function uploadBankTransferScreenshot(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('screenshot', file);

  const response = await fetch(`${API_BASE_URL}/api/pos/upload/screenshot`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to upload screenshot');
  }

  const data = await response.json();
  return data.data || data;
}
