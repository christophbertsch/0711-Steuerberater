import { Document } from '../types';

class DocumentService {
  private baseUrl = this.getBaseUrl();

  private getBaseUrl(): string {
    // Check if we're in development or if the API is available locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api';
    }
    // For deployed versions, we need to handle the case where there's no backend
    // This is a placeholder - in a real deployment, you'd point to your backend API
    return '/api';
  }

  async uploadDocument(file: File, onProgress?: (progress: number) => void): Promise<Document> {
    // First check if backend is available
    try {
      const healthCheck = await fetch(`${this.baseUrl}/documents`, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (!healthCheck.ok) {
        throw new Error('Backend not available');
      }
    } catch (error) {
      console.log('Backend not available, using mock response for:', file.name);
      
      // Simulate upload progress
      if (onProgress) {
        const progressInterval = setInterval(() => {
          let progress = 0;
          const progressStep = setInterval(() => {
            progress += 10;
            onProgress(progress);
            if (progress >= 100) {
              clearInterval(progressStep);
            }
          }, 50);
          clearInterval(progressInterval);
        }, 0);
      }
      
      // Return mock document after delay
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            id: Date.now().toString(),
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: new Date(),
            filePath: `mock-uploads/${file.name}`, // Legacy field
            blobUrl: `https://mock-blob-url.vercel-storage.com/documents/${file.name}`, // Mock blob URL
            blobPathname: `documents/${file.name}`
          });
        }, 1000);
      });
    }

    // Backend is available, proceed with real upload
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
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${xhr.responseText}`));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      const uploadUrl = `${this.baseUrl}/documents/upload`;
      console.log('Uploading to:', uploadUrl);
      xhr.open('POST', uploadUrl);
      xhr.send(formData);
    });
  }

  async getDocuments(): Promise<Document[]> {
    try {
      const response = await fetch(`${this.baseUrl}/documents`, {
        signal: AbortSignal.timeout(2000)
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    } catch (error) {
      console.log('Backend not available, returning empty document list');
      return [];
    }
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

  async listBlobFiles(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/blob/list`);
      if (!response.ok) {
        throw new Error('Failed to list blob files');
      }
      return response.json();
    } catch (error) {
      console.error('Failed to list blob files:', error);
      return [];
    }
  }

  async migrateLocalFiles(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/blob/migrate`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to migrate files');
      }
      return response.json();
    } catch (error) {
      console.error('Failed to migrate files:', error);
      throw error;
    }
  }
}

export const documentService = new DocumentService();