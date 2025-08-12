import { TaxResearchResult, TaxLawUpdate } from '../types';

class ResearchService {
  private baseUrl = 'http://localhost:56534/api';

  async searchTaxLaw(query: string): Promise<TaxResearchResult> {
    const response = await fetch(`${this.baseUrl}/research/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error('Failed to search tax law');
    }

    return response.json();
  }

  async getRecentTaxUpdates2024(): Promise<TaxLawUpdate[]> {
    const response = await fetch(`${this.baseUrl}/research/updates/2024`);

    if (!response.ok) {
      throw new Error('Failed to fetch recent tax updates');
    }

    return response.json();
  }

  async getTaxChangesForYear(year: number): Promise<TaxLawUpdate[]> {
    const response = await fetch(`${this.baseUrl}/research/updates/${year}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch tax changes for ${year}`);
    }

    return response.json();
  }

  async searchSpecificTopic(topic: string): Promise<TaxResearchResult> {
    const response = await fetch(`${this.baseUrl}/research/topic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error('Failed to search specific topic');
    }

    return response.json();
  }

  async getDeductionGuidelines(category: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/research/deductions/${category}`);

    if (!response.ok) {
      throw new Error('Failed to fetch deduction guidelines');
    }

    return response.json();
  }
}

export const researchService = new ResearchService();