/**
 * Tavily API Service
 * Integration with Tavily search API for authoritative German tax sources
 */

export interface TavilySearchRequest {
  query: string;
  search_depth?: 'basic' | 'advanced';
  include_domains?: string[];
  exclude_domains?: string[];
  max_results?: number;
  include_raw_content?: boolean;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  published_date?: string;
  score: number;
}

export interface TavilySearchResponse {
  query: string;
  follow_up_questions?: string[];
  answer: string;
  images?: string[];
  results: TavilySearchResult[];
  response_time: number;
}

export class TavilyService {
  private readonly baseUrl = 'https://api.tavily.com';
  private readonly apiKey: string | null;

  constructor() {
    // In production, get from environment variable
    this.apiKey = process.env.REACT_APP_TAVILY_API_KEY || null;
  }

  /**
   * Search for German tax law content using Tavily
   */
  async search(request: TavilySearchRequest): Promise<TavilySearchResponse> {
    if (!this.apiKey) {
      console.warn('⚠️ Tavily API key not configured, using mock data');
      return this.getMockSearchResponse(request);
    }

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: request.query,
          search_depth: request.search_depth || 'basic',
          include_domains: request.include_domains || [],
          exclude_domains: request.exclude_domains || [],
          max_results: request.max_results || 10,
          include_raw_content: request.include_raw_content || false,
          include_answer: true,
          include_images: false
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error('❌ Tavily search failed:', error);
      // Fallback to mock data
      return this.getMockSearchResponse(request);
    }
  }

  /**
   * Extract content from specific URLs using Tavily
   */
  async extract(urls: string[]): Promise<Array<{ url: string; content: string; raw_content?: string }>> {
    if (!this.apiKey) {
      console.warn('⚠️ Tavily API key not configured, using mock data');
      return this.getMockExtractionResponse(urls);
    }

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          urls,
          extract_depth: 'advanced'
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily extract API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];

    } catch (error) {
      console.error('❌ Tavily extraction failed:', error);
      return this.getMockExtractionResponse(urls);
    }
  }

  /**
   * Mock search response for development/fallback
   */
  private getMockSearchResponse(request: TavilySearchRequest): TavilySearchResponse {
    const mockResults: TavilySearchResult[] = [
      {
        title: 'EStG § 9 Werbungskosten - Gesetze im Internet',
        url: 'https://www.gesetze-im-internet.de/estg/__9.html',
        content: 'Werbungskosten sind Aufwendungen zur Erwerbung, Sicherung und Erhaltung der Einnahmen. Sie sind bei der Einkunftsart abzuziehen, bei der sie erwachsen sind. Der Pauschbetrag für Werbungskosten beträgt 1.230 Euro.',
        published_date: '2024-01-01',
        score: 0.95
      },
      {
        title: 'Einkommensteuer - Bundesfinanzministerium',
        url: 'https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerarten/Einkommensteuer/einkommensteuer.html',
        content: 'Die Einkommensteuer ist eine Steuer auf das Einkommen natürlicher Personen. Grundlage ist das Einkommensteuergesetz (EStG). Werbungskosten mindern die steuerpflichtigen Einkünfte.',
        published_date: '2024-01-15',
        score: 0.88
      },
      {
        title: 'BMF-Schreiben zu Werbungskosten',
        url: 'https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2024-01-01-werbungskosten.pdf',
        content: 'Aktuelle Hinweise zur steuerlichen Behandlung von Werbungskosten. Der Pauschbetrag wurde für 2024 auf 1.230 Euro erhöht. Höhere Werbungskosten sind durch Belege nachzuweisen.',
        published_date: '2024-01-01',
        score: 0.92
      },
      {
        title: 'BFH-Urteil zu Werbungskosten bei Homeoffice',
        url: 'https://www.bundesfinanzhof.de/de/entscheidung/entscheidungen-online/detail/STRE202310001/',
        content: 'Der Bundesfinanzhof hat entschieden, dass Kosten für das häusliche Arbeitszimmer unter bestimmten Voraussetzungen als Werbungskosten abzugsfähig sind.',
        published_date: '2023-12-15',
        score: 0.85
      }
    ];

    // Filter by domains if specified
    let filteredResults = mockResults;
    if (request.include_domains && request.include_domains.length > 0) {
      filteredResults = mockResults.filter(result => {
        const url = new URL(result.url);
        return request.include_domains!.some(domain => url.hostname.includes(domain));
      });
    }

    // Limit results
    if (request.max_results) {
      filteredResults = filteredResults.slice(0, request.max_results);
    }

    return {
      query: request.query,
      answer: `Basierend auf den deutschen Steuergesetzen sind ${request.query} wichtige Aspekte der Einkommensteuer. Der aktuelle Pauschbetrag beträgt 1.230 Euro für das Jahr 2024.`,
      results: filteredResults,
      response_time: 0.5,
      follow_up_questions: [
        'Wie hoch ist der Werbungskosten-Pauschbetrag 2024?',
        'Welche Belege brauche ich für Werbungskosten?',
        'Kann ich Homeoffice-Kosten absetzen?'
      ]
    };
  }

  /**
   * Mock extraction response for development/fallback
   */
  private getMockExtractionResponse(urls: string[]): Array<{ url: string; content: string; raw_content?: string }> {
    return urls.map(url => ({
      url,
      content: `Mock extracted content from ${url}. This would contain the full text content of the webpage, including legal paragraphs, definitions, and calculation rules.`,
      raw_content: `<html><body><h1>Mock Content</h1><p>Full HTML content would be here...</p></body></html>`
    }));
  }

  /**
   * Get authorized German tax domains for search filtering
   */
  static getAuthorizedDomains(): string[] {
    return [
      'bundesfinanzministerium.de',
      'gesetze-im-internet.de',
      'elster.de',
      'bundesfinanzhof.de',
      'bundessteuerblatt.de',
      'formulare-bfinv.de',
      'steuerliches-info-center.de'
    ];
  }

  /**
   * Build search query for German tax topics
   */
  static buildTaxQuery(topic: string, year?: number): string {
    const currentYear = year || new Date().getFullYear();
    return `${topic} Deutschland Steuerrecht ${currentYear} EStG`;
  }
}