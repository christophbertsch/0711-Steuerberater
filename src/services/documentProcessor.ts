import { Document } from '../types';

export interface ProcessedDocument extends Document {
  extractedText: string;
  contentAnalysis: {
    hasText: boolean;
    isScanned: boolean;
    language: string;
    confidence: number;
  };
}

class DocumentProcessor {
  private baseUrl = '/api';

  /**
   * Process a document by extracting text and analyzing content
   */
  async processDocument(file: File): Promise<ProcessedDocument> {
    try {
      // First, try to extract text on the client side for immediate feedback
      const clientExtractedText = await this.extractTextClientSide(file);
      
      // Upload the document to the server for server-side processing
      const uploadedDoc = await this.uploadDocument(file);
      
      // Combine client and server results
      return {
        ...uploadedDoc,
        extractedText: uploadedDoc.extractedText || clientExtractedText,
        contentAnalysis: {
          hasText: (uploadedDoc.extractedText || clientExtractedText).length > 0,
          isScanned: this.detectScannedDocument(file.name, uploadedDoc.extractedText || clientExtractedText),
          language: this.detectLanguage(uploadedDoc.extractedText || clientExtractedText),
          confidence: this.calculateExtractionConfidence(uploadedDoc.extractedText || clientExtractedText)
        }
      };
    } catch (error: unknown) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text on the client side for immediate feedback
   */
  private async extractTextClientSide(file: File): Promise<string> {
    if (file.type === 'application/pdf') {
      // For PDFs, we'll rely on server-side extraction
      return '';
    }
    
    if (file.type.startsWith('text/') || file.name.endsWith('.xml')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    return '';
  }

  /**
   * Upload document to server with enhanced processing
   */
  private async uploadDocument(file: File): Promise<Document & { extractedText?: string }> {
    const formData = new FormData();
    formData.append('document', file);

    const response = await fetch(`${this.baseUrl}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Detect if document is likely a scanned image
   */
  private detectScannedDocument(filename: string, extractedText: string): boolean {
    // If very little text was extracted from a PDF, it's likely scanned
    if (filename.toLowerCase().endsWith('.pdf') && extractedText.length < 100) {
      return true;
    }
    
    // Check for OCR-typical patterns
    const ocrPatterns = [
      /[Il1|]{3,}/, // Common OCR misreads
      /\s{5,}/, // Excessive whitespace
      /[^\w\s]{10,}/, // Too many special characters
    ];
    
    return ocrPatterns.some(pattern => pattern.test(extractedText));
  }

  /**
   * Detect document language
   */
  private detectLanguage(text: string): string {
    if (!text || text.length < 50) return 'unknown';
    
    // Simple German detection
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'mit', 'für', 'von', 'auf', 'zu', 'steuer', 'rechnung', 'betrag'];
    const englishWords = ['the', 'and', 'is', 'with', 'for', 'from', 'on', 'to', 'tax', 'invoice', 'amount'];
    
    const lowerText = text.toLowerCase();
    const germanCount = germanWords.filter(word => lowerText.includes(word)).length;
    const englishCount = englishWords.filter(word => lowerText.includes(word)).length;
    
    if (germanCount > englishCount) return 'de';
    if (englishCount > germanCount) return 'en';
    return 'unknown';
  }

  /**
   * Calculate confidence in text extraction
   */
  private calculateExtractionConfidence(text: string): number {
    if (!text) return 0;
    
    // Base confidence on text length and structure
    let confidence = Math.min(text.length / 1000, 1); // Up to 1000 chars = 100%
    
    // Boost confidence if we find structured content
    if (text.includes('€') || text.includes('EUR')) confidence += 0.1;
    if (/\d{2}\.\d{2}\.\d{4}/.test(text)) confidence += 0.1; // Date patterns
    if (/\d+[,\.]\d{2}/.test(text)) confidence += 0.1; // Money patterns
    if (text.includes('Rechnung') || text.includes('Invoice')) confidence += 0.1;
    if (text.includes('Steuer') || text.includes('Tax')) confidence += 0.1;
    
    return Math.min(confidence, 1);
  }

  /**
   * Get document processing status
   */
  async getProcessingStatus(documentId: string): Promise<{
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    extractedText?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/documents/${documentId}/status`);
      if (!response.ok) {
        throw new Error('Failed to get processing status');
      }
      return response.json();
    } catch (error: unknown) {
      return {
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reprocess document with enhanced extraction
   */
  async reprocessDocument(documentId: string, options: {
    useOCR?: boolean;
    enhancedExtraction?: boolean;
  } = {}): Promise<ProcessedDocument> {
    const response = await fetch(`${this.baseUrl}/documents/${documentId}/reprocess`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error('Failed to reprocess document');
    }

    return response.json();
  }
}

export const documentProcessor = new DocumentProcessor();