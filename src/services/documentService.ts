import { Document } from '../types';

class DocumentService {
  private baseUrl = 'http://localhost:56534/api';

  async uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<Document> {
    const formData = new FormData();
    formData.append('document', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${this.baseUrl}/documents/upload`);
      xhr.send(formData);
    });
  }

  async getDocuments(): Promise<Document[]> {
    const response = await fetch(`${this.baseUrl}/documents`);
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    return response.json();
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
  }

  async extractText(file: File): Promise<string> {
    // Client-side text extraction for immediate feedback
    if (file.type === 'application/pdf') {
      // For PDF files, we'll rely on the server-side extraction
      return '';
    }
    
    if (file.type.startsWith('image/')) {
      // For images, we could use Tesseract.js for OCR
      return '';
    }

    if (file.type.includes('text') || file.name.endsWith('.xml')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    return '';
  }
}

export const documentService = new DocumentService();