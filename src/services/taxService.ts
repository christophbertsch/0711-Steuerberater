import { TaxDeclaration } from '../types';
import jsPDF from 'jspdf';

class TaxService {
  private baseUrl = '/api';

  async generateTaxDeclaration(data: any): Promise<TaxDeclaration> {
    const response = await fetch(`${this.baseUrl}/tax/generate-declaration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to generate tax declaration');
    }

    return response.json();
  }

  async calculateTax(income: number, deductions: number, personalInfo: any): Promise<number> {
    const response = await fetch(`${this.baseUrl}/tax/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ income, deductions, personalInfo }),
    });

    if (!response.ok) {
      throw new Error('Failed to calculate tax');
    }

    const result = await response.json();
    return result.tax;
  }

  async downloadTaxDeclaration(declaration: TaxDeclaration): Promise<void> {
    // Generate PDF using jsPDF
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Tax Declaration 2024', 20, 30);
    
    // Add personal information
    doc.setFontSize(14);
    doc.text('Personal Information', 20, 50);
    doc.setFontSize(12);
    doc.text(`Name: ${declaration.personalInfo.firstName} ${declaration.personalInfo.lastName}`, 20, 65);
    doc.text(`Tax ID: ${declaration.personalInfo.taxId}`, 20, 75);
    doc.text(`Address: ${declaration.personalInfo.address}`, 20, 85);
    
    // Add income information
    doc.setFontSize(14);
    doc.text('Income Information', 20, 110);
    doc.setFontSize(12);
    doc.text(`Total Income: €${declaration.income.total.toFixed(2)}`, 20, 125);
    doc.text(`Salary: €${declaration.income.salary.toFixed(2)}`, 30, 135);
    doc.text(`Freelance: €${declaration.income.freelance.toFixed(2)}`, 30, 145);
    doc.text(`Investments: €${declaration.income.investments.toFixed(2)}`, 30, 155);
    doc.text(`Other: €${declaration.income.other.toFixed(2)}`, 30, 165);
    
    // Add deductions
    doc.setFontSize(14);
    doc.text('Deductions', 20, 190);
    doc.setFontSize(12);
    doc.text(`Total Deductions: €${declaration.deductions.total.toFixed(2)}`, 20, 205);
    doc.text(`Work Expenses: €${declaration.deductions.workExpenses.toFixed(2)}`, 30, 215);
    doc.text(`Donations: €${declaration.deductions.donations.toFixed(2)}`, 30, 225);
    doc.text(`Health Insurance: €${declaration.deductions.healthInsurance.toFixed(2)}`, 30, 235);
    doc.text(`Education: €${declaration.deductions.education.toFixed(2)}`, 30, 245);
    
    // Add tax calculation
    doc.setFontSize(14);
    doc.text('Tax Calculation', 20, 270);
    doc.setFontSize(12);
    doc.text(`Calculated Tax: €${declaration.calculatedTax.toFixed(2)}`, 20, 285);
    doc.text(`Expected Refund: €${declaration.refundAmount.toFixed(2)}`, 20, 295);
    
    // Save the PDF
    doc.save('tax-declaration-2024.pdf');
  }

  async validateTaxDeclaration(declaration: TaxDeclaration): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tax/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(declaration),
    });

    if (!response.ok) {
      throw new Error('Failed to validate tax declaration');
    }

    return response.json();
  }

  async submitTaxDeclaration(declaration: TaxDeclaration): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tax/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(declaration),
    });

    if (!response.ok) {
      throw new Error('Failed to submit tax declaration');
    }

    return response.json();
  }
}

export const taxService = new TaxService();