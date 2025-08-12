import { Document, DocumentAnalysis } from '../types';

class AIService {
  private baseUrl = '/api';

  async analyzeDocument(document: Document): Promise<DocumentAnalysis> {
    const response = await fetch(`${this.baseUrl}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId: document.id }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze document');
    }

    return response.json();
  }

  async getExpertOpinion(documentType: string, content: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/ai/expert-opinion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentType, content }),
    });

    if (!response.ok) {
      throw new Error('Failed to get expert opinion');
    }

    return response.json();
  }

  async extractDataFromDocument(document: Document): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/ai/extract-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId: document.id }),
    });

    if (!response.ok) {
      throw new Error('Failed to extract data from document');
    }

    return response.json();
  }

  async classifyDocument(content: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/ai/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error('Failed to classify document');
    }

    const result = await response.json();
    return result.documentType;
  }

  async calculateTaxRelevance(documentType: string, content: string): Promise<'high' | 'medium' | 'low' | 'none'> {
    const response = await fetch(`${this.baseUrl}/ai/tax-relevance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentType, content }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate tax relevance');
    }

    const result = await response.json();
    return result.relevance;
  }
}

export const aiService = new AIService();