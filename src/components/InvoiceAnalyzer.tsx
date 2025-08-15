import React, { useState, useEffect } from 'react';

interface InvoiceData {
  id: string;
  filename: string;
  amount: number;
  date: string;
  vendor: string;
  category: 'werbungskosten' | 'health_insurance' | 'education' | 'donations' | 'other';
  description: string;
  confidence: number;
  taxType: 'employee' | 'self_employed';
  vatDeductible: boolean;
}

interface DeductionSummary {
  werbungskosten: number;
  health_insurance: number;
  education: number;
  donations: number;
  other: number;
  total: number;
}

const InvoiceAnalyzer: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [deductions, setDeductions] = useState<DeductionSummary>({
    werbungskosten: 0,
    health_insurance: 0,
    education: 0,
    donations: 0,
    other: 0,
    total: 0
  });
  const [employmentStatus, setEmploymentStatus] = useState<'employee' | 'self_employed' | 'unknown'>('unknown');
  const [loading, setLoading] = useState(false);

  // Erkenne Beschäftigungsstatus aus Lohnsteuerbescheinigung
  const detectEmploymentStatus = async (): Promise<'employee' | 'self_employed' | 'unknown'> => {
    try {
      console.log('🔍 Erkenne Beschäftigungsstatus...');
      
      // Suche nach Lohnsteuerbescheinigung
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Lohnsteuerbescheinigung Bruttoarbeitslohn',
          limit: 5
        })
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        
        for (const doc of results) {
          const text = doc.text?.toLowerCase() || '';
          
          // Indikatoren für Angestelltenverhältnis
          if (text.includes('lohnsteuerbescheinigung') || 
              text.includes('bruttoarbeitslohn') ||
              text.includes('arbeitgeber') ||
              text.includes('lohnsteuer') ||
              text.includes('sozialversicherung')) {
            console.log('✅ Angestelltenverhältnis erkannt (Lohnsteuerbescheinigung gefunden)');
            return 'employee';
          }
          
          // Indikatoren für Selbständigkeit
          if (text.includes('gewinn') ||
              text.includes('umsatzsteuer') ||
              text.includes('betriebsausgaben') ||
              text.includes('freiberufler') ||
              text.includes('selbständig')) {
            console.log('✅ Selbständigkeit erkannt');
            return 'self_employed';
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler bei der Statuserkennung:', error);
    }
    
    console.log('❓ Beschäftigungsstatus unbekannt');
    return 'unknown';
  };

  // Analysiere Rechnungen und kategorisiere sie automatisch
  const analyzeInvoices = async () => {
    setLoading(true);
    try {
      console.log('🔍 Analysiere Rechnungen für Steuerabzüge...');
      
      // Erkenne zuerst den Beschäftigungsstatus
      const status = await detectEmploymentStatus();
      setEmploymentStatus(status);
      
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
          const invoiceData = extractInvoiceData(doc.text, doc.filename, doc.id, status);
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
  const extractInvoiceData = (text: string, filename: string, id: string, empStatus: 'employee' | 'self_employed' | 'unknown'): InvoiceData | null => {
    if (!text) return null;

    // Extrahiere Betrag
    const amount = extractAmount(text);
    if (amount === 0) return null;

    // Extrahiere Datum
    const date = extractDate(text);
    
    // Extrahiere Anbieter/Firma
    const vendor = extractVendor(text, filename);
    
    // Kategorisiere automatisch basierend auf Beschäftigungsstatus
    const category = categorizeInvoice(text, filename, empStatus);
    
    // Erstelle Beschreibung
    const description = generateDescription(text, filename, category, empStatus);
    
    // Berechne Vertrauenswert
    const confidence = calculateConfidence(text, amount, date, vendor);

    // Bestimme ob USt abziehbar ist (nur für Selbständige)
    const vatDeductible = empStatus === 'self_employed' && text.toLowerCase().includes('umsatzsteuer');

    return {
      id,
      filename,
      amount,
      date,
      vendor,
      category,
      description,
      confidence,
      taxType: empStatus === 'unknown' ? 'employee' : empStatus, // Default zu Angestellter
      vatDeductible
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

  // Kategorisiere Rechnung automatisch basierend auf Beschäftigungsstatus
  const categorizeInvoice = (text: string, filename: string, _empStatus: 'employee' | 'self_employed' | 'unknown'): InvoiceData['category'] => {
    const content = (text + ' ' + filename).toLowerCase();

    // Berufliche Ausgaben (Werbungskosten für Angestellte, Betriebsausgaben für Selbständige)
    if (content.match(/(büro|office|computer|laptop|software|internet|telefon|handy|fahrt|reise|hotel|benzin|diesel|tankstelle|parkplatz|datentechnik|thinkpad)/)) {
      return 'werbungskosten'; // Wird später im UI entsprechend angezeigt
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
  const generateDescription = (_text: string, filename: string, category: InvoiceData['category'], empStatus: 'employee' | 'self_employed' | 'unknown'): string => {
    const categoryNames = {
      werbungskosten: empStatus === 'self_employed' ? 'Betriebsausgaben' : 'Werbungskosten',
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
      werbungskosten: 0,
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
    werbungskosten: employmentStatus === 'self_employed' ? 'Betriebsausgaben' : 'Werbungskosten',
    health_insurance: 'Gesundheitskosten',
    education: 'Bildungskosten',
    donations: 'Spenden',
    other: 'Sonstige Abzüge'
  };

  const categoryColors = {
    werbungskosten: 'bg-blue-50 text-blue-800 border-blue-200',
    health_insurance: 'bg-green-50 text-green-800 border-green-200',
    education: 'bg-purple-50 text-purple-800 border-purple-200',
    donations: 'bg-pink-50 text-pink-800 border-pink-200',
    other: 'bg-gray-50 text-gray-800 border-gray-200'
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              📊 Automatische Rechnungsanalyse für Steuerabzüge
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm px-2 py-1 rounded-full ${
                employmentStatus === 'employee' ? 'bg-green-100 text-green-800' :
                employmentStatus === 'self_employed' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {employmentStatus === 'employee' ? '👔 Angestellter (Werbungskosten)' :
                 employmentStatus === 'self_employed' ? '💼 Selbständig (Betriebsausgaben)' :
                 '❓ Status unbekannt'}
              </span>
            </div>
          </div>
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
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            invoice.taxType === 'employee' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {invoice.taxType === 'employee' ? 'Angestellter' : 'Selbständig'}
                          </span>
                          {invoice.vatDeductible && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                              USt abziehbar
                            </span>
                          )}
                          {!invoice.vatDeductible && invoice.taxType === 'employee' && (
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              Keine USt-Abzug
                            </span>
                          )}
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
          <h4 className="font-medium text-blue-900 mb-2">💡 Steuerliche Hinweise für {employmentStatus === 'employee' ? 'Angestellte' : employmentStatus === 'self_employed' ? 'Selbständige' : 'Steuerpflichtige'}:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {employmentStatus === 'employee' ? (
              <>
                <li>• <strong>Werbungskosten:</strong> Beruflich veranlasste Ausgaben (Computer, Software, Fachliteratur)</li>
                <li>• <strong>Arbeitsmittel:</strong> Laptop, Handy, Büromaterial für berufliche Nutzung</li>
                <li>• <strong>Fortbildung:</strong> Berufsbezogene Kurse und Seminare</li>
                <li>• <strong>Fahrtkosten:</strong> Dienstreisen, Fortbildungsfahrten</li>
                <li>• <strong>Keine USt-Abzug:</strong> Als Angestellter können Sie keine Vorsteuer abziehen</li>
              </>
            ) : employmentStatus === 'self_employed' ? (
              <>
                <li>• <strong>Betriebsausgaben:</strong> Alle betrieblich veranlassten Ausgaben</li>
                <li>• <strong>Vorsteuerabzug:</strong> 19% USt können als Vorsteuer abgezogen werden</li>
                <li>• <strong>Büroausstattung:</strong> Computer, Software, Büromöbel</li>
                <li>• <strong>Geschäftsreisen:</strong> Fahrt-, Hotel- und Bewirtungskosten</li>
              </>
            ) : (
              <>
                <li>• <strong>Status wird automatisch erkannt:</strong> Basierend auf Lohnsteuerbescheinigung oder Gewinn-/Verlustrechnung</li>
                <li>• <strong>Angestellte:</strong> Werbungskosten (keine USt-Abzug)</li>
                <li>• <strong>Selbständige:</strong> Betriebsausgaben (mit USt-Abzug)</li>
              </>
            )}
            <li>• <strong>Gesundheitskosten:</strong> Arzt, Medizin, Apotheke, Brille</li>
            <li>• <strong>Spenden:</strong> Wohltätige Organisationen, Hilfsorganisationen</li>
            <li>• Nur Rechnungen mit ≥60% Vertrauen werden in die Abzüge einbezogen</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InvoiceAnalyzer;