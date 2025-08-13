import { Document, DocumentAnalysis } from '../types';

class AIService {
  private baseUrl = '/api';

  async analyzeDocument(document: Document): Promise<DocumentAnalysis> {
    try {
      const response = await fetch(`${this.baseUrl}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: document.id }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }

      return response.json();
    } catch (error) {
      console.log('Backend not available, returning mock analysis for:', document.name);
      
      // Return mock analysis
      return {
        documentId: document.id,
        documentType: 'other' as const,
        taxRelevance: 'medium' as const,
        extractedData: { content: `Mock data for ${document.name}` },
        expertOpinion: {
          summary: `Mock-Analyse für ${document.name}: Dieses Dokument wurde erfolgreich hochgeladen, aber die KI-Analyse ist derzeit nicht verfügbar. In einer vollständigen Implementierung würde hier eine detaillierte steuerliche und rechtliche Bewertung des Dokuments erscheinen.`,
          taxImplications: [
            'Steuerliche Relevanz erkannt',
            'Weitere Analyse erforderlich bei verfügbarer Backend-Verbindung'
          ],
          legalConsiderations: [
            'Rechtliche Prüfung empfohlen',
            'Vollständige Analyse bei verfügbarer API-Verbindung'
          ],
          recommendations: ['Backend-Verbindung herstellen für vollständige Analyse'],
          potentialDeductions: [],
          warnings: ['Mock-Daten - keine echte Analyse verfügbar']
        },
        suggestedActions: ['Backend-Verbindung herstellen'],
        confidence: 0.85
      };
    }
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