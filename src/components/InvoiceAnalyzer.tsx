import React, { useState, useEffect } from 'react';

interface InvoiceData {
  id: string;
  filename: string;
  amount: number;
  date: string;
  vendor: string;
  category: 'work_expenses' | 'health_insurance' | 'education' | 'donations' | 'other';
  description: string;
  confidence: number;
}

interface DeductionSummary {
  work_expenses: number;
  health_insurance: number;
  education: number;
  donations: number;
  other: number;
  total: number;
}

const InvoiceAnalyzer: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [deductions, setDeductions] = useState<DeductionSummary>({
    work_expenses: 0,
    health_insurance: 0,
    education: 0,
    donations: 0,
    other: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  // Analysiere Rechnungen und kategorisiere sie automatisch
  const analyzeInvoices = async () => {
    setLoading(true);
    try {
      console.log('🔍 Analysiere Rechnungen für Steuerabzüge...');
      
      // Suche nach Rechnungen in Qdrant
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Rechnung Invoice Beleg Quittung',
          limit: 20
        })
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        
        console.log(`📄 ${results.length} Rechnungen gefunden`);
        
        const analyzedInvoices: InvoiceData[] = [];
        
        for (const doc of results) {
          const invoiceData = extractInvoiceData(doc.text, doc.filename, doc.id);
          if (invoiceData) {
            analyzedInvoices.push(invoiceData);
          }
        }
        
        setInvoices(analyzedInvoices);
        calculateDeductions(analyzedInvoices);
        
      } else {
        console.error('❌ Fehler beim Laden der Rechnungen');
      }
    } catch (error) {
      console.error('❌ Fehler bei der Rechnungsanalyse:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extrahiere Rechnungsdaten aus Text
  const extractInvoiceData = (text: string, filename: string, id: string): InvoiceData | null => {
    if (!text) return null;

    // Extrahiere Betrag
    const amount = extractAmount(text);
    if (amount === 0) return null;

    // Extrahiere Datum
    const date = extractDate(text);
    
    // Extrahiere Anbieter/Firma
    const vendor = extractVendor(text, filename);
    
    // Kategorisiere automatisch
    const category = categorizeInvoice(text, filename);
    
    // Erstelle Beschreibung
    const description = generateDescription(text, filename, category);
    
    // Berechne Vertrauenswert
    const confidence = calculateConfidence(text, amount, date, vendor);

    return {
      id,
      filename,
      amount,
      date,
      vendor,
      category,
      description,
      confidence
    };
  };

  // Extrahiere Betrag aus Rechnungstext
  const extractAmount = (text: string): number => {
    const patterns = [
      // Deutsche Rechnungsformate
      /Gesamtbetrag[:\s]*([0-9.,]+)\s*€/i,
      /Summe[:\s]*([0-9.,]+)\s*€/i,
      /Betrag[:\s]*([0-9.,]+)\s*€/i,
      /Total[:\s]*([0-9.,]+)\s*€/i,
      /€\s*([0-9.,]+)/i,
      /([0-9.,]+)\s*EUR/i,
      // Englische Formate
      /Amount[:\s]*€?([0-9.,]+)/i,
      /Total[:\s]*€?([0-9.,]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const numStr = match[1].replace(/\./g, '').replace(',', '.');
        const num = parseFloat(numStr);
        if (!isNaN(num) && num > 0 && num < 100000) { // Plausibilitätsprüfung
          return Math.round(num * 100) / 100; // Auf 2 Dezimalstellen runden
        }
      }
    }
    return 0;
  };

  // Extrahiere Datum
  const extractDate = (text: string): string => {
    const patterns = [
      /Datum[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /Date[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(\d{1,2}\.\d{1,2}\.\d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return new Date().toLocaleDateString('de-DE');
  };

  // Extrahiere Anbieter/Firma
  const extractVendor = (text: string, filename: string): string => {
    // Versuche Firmenname aus Dateiname zu extrahieren
    const filenameVendor = filename.split(/[-_\s]/)[0];
    if (filenameVendor && filenameVendor.length > 2) {
      return filenameVendor;
    }

    // Suche nach Firmenmustern im Text
    const patterns = [
      /Firma[:\s]*([^\n]+)/i,
      /Company[:\s]*([^\n]+)/i,
      /Von[:\s]*([^\n]+)/i,
      /From[:\s]*([^\n]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 50);
      }
    }

    return 'Unbekannt';
  };

  // Kategorisiere Rechnung automatisch
  const categorizeInvoice = (text: string, filename: string): InvoiceData['category'] => {
    const content = (text + ' ' + filename).toLowerCase();

    // Arbeitskosten
    if (content.match(/(büro|office|computer|laptop|software|internet|telefon|handy|fahrt|reise|hotel|benzin|diesel|tankstelle|parkplatz)/)) {
      return 'work_expenses';
    }

    // Gesundheit/Krankenversicherung
    if (content.match(/(arzt|doctor|kranken|health|medizin|medicine|apotheke|pharmacy|brille|glasses)/)) {
      return 'health_insurance';
    }

    // Bildung
    if (content.match(/(kurs|course|seminar|training|weiterbildung|education|schule|university|universität|buch|book)/)) {
      return 'education';
    }

    // Spenden
    if (content.match(/(spende|donation|charity|hilfe|help|unicef|rotes kreuz|caritas)/)) {
      return 'donations';
    }

    return 'other';
  };

  // Generiere Beschreibung
  const generateDescription = (_text: string, filename: string, category: InvoiceData['category']): string => {
    const categoryNames = {
      work_expenses: 'Arbeitskosten',
      health_insurance: 'Gesundheitskosten',
      education: 'Bildungskosten',
      donations: 'Spenden',
      other: 'Sonstige Kosten'
    };

    return `${categoryNames[category]} - ${filename}`;
  };

  // Berechne Vertrauenswert
  const calculateConfidence = (text: string, amount: number, date: string, vendor: string): number => {
    let confidence = 0;
    
    if (amount > 0) confidence += 40;
    if (date !== new Date().toLocaleDateString('de-DE')) confidence += 20;
    if (vendor !== 'Unbekannt') confidence += 20;
    if (text.length > 100) confidence += 20;
    
    return Math.min(confidence, 100);
  };

  // Berechne Gesamtabzüge
  const calculateDeductions = (invoices: InvoiceData[]) => {
    const summary: DeductionSummary = {
      work_expenses: 0,
      health_insurance: 0,
      education: 0,
      donations: 0,
      other: 0,
      total: 0
    };

    invoices.forEach(invoice => {
      if (invoice.confidence >= 60) { // Nur vertrauenswürdige Rechnungen
        summary[invoice.category] += invoice.amount;
        summary.total += invoice.amount;
      }
    });

    setDeductions(summary);
  };

  // Lade Rechnungen beim Komponenten-Start
  useEffect(() => {
    analyzeInvoices();
  }, []);

  const categoryLabels = {
    work_expenses: 'Arbeitskosten',
    health_insurance: 'Gesundheitskosten',
    education: 'Bildungskosten',
    donations: 'Spenden',
    other: 'Sonstige Abzüge'
  };

  const categoryColors = {
    work_expenses: 'bg-blue-50 text-blue-800 border-blue-200',
    health_insurance: 'bg-green-50 text-green-800 border-green-200',
    education: 'bg-purple-50 text-purple-800 border-purple-200',
    donations: 'bg-pink-50 text-pink-800 border-pink-200',
    other: 'bg-gray-50 text-gray-800 border-gray-200'
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            📊 Automatische Rechnungsanalyse für Steuerabzüge
          </h2>
          <button
            onClick={analyzeInvoices}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '🔄 Analysiere...' : '🔍 Neu analysieren'}
          </button>
        </div>

        {/* Zusammenfassung der Abzüge */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {Object.entries(deductions).map(([key, value]) => (
            <div key={key} className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 font-medium">
                {key === 'total' ? 'Gesamt' : categoryLabels[key as keyof typeof categoryLabels]}
              </div>
              <div className={`text-lg font-bold ${key === 'total' ? 'text-blue-800' : 'text-gray-800'}`}>
                €{value.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>

        {/* Liste der analysierten Rechnungen */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">
            📄 Analysierte Rechnungen ({invoices.length})
          </h3>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {loading ? '🔄 Analysiere Rechnungen...' : '📄 Keine Rechnungen gefunden'}
            </div>
          ) : (
            <div className="space-y-2">
              {invoices
                .sort((a, b) => b.amount - a.amount)
                .map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`p-4 rounded-lg border ${categoryColors[invoice.category]} ${
                      invoice.confidence < 60 ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{invoice.filename}</span>
                          <span className="text-xs px-2 py-1 bg-white rounded-full">
                            {invoice.confidence}% Vertrauen
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {invoice.description} • {invoice.vendor} • {invoice.date}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          €{invoice.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {categoryLabels[invoice.category]}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Hinweise */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">💡 Hinweise zur automatischen Kategorisierung:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Arbeitskosten:</strong> Büro, Computer, Software, Reisen, Fahrtkosten</li>
            <li>• <strong>Gesundheitskosten:</strong> Arzt, Medizin, Apotheke, Brille</li>
            <li>• <strong>Bildungskosten:</strong> Kurse, Seminare, Weiterbildung, Bücher</li>
            <li>• <strong>Spenden:</strong> Wohltätige Organisationen, Hilfsorganisationen</li>
            <li>• Nur Rechnungen mit ≥60% Vertrauen werden in die Abzüge einbezogen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InvoiceAnalyzer;