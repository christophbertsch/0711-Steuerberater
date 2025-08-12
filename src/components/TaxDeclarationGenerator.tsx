import React, { useState, useEffect } from 'react';
import { Calculator, Download, Euro, User, Building, Heart, GraduationCap } from 'lucide-react';
import { Document, TaxDeclaration, PersonalInfo, IncomeData, DeductionData } from '../types';
import { taxService } from '../services/taxService';

interface TaxDeclarationGeneratorProps {
  documents: Document[];
}

const TaxDeclarationGenerator: React.FC<TaxDeclarationGeneratorProps> = ({ documents }) => {
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    address: '',
    taxId: '',
    maritalStatus: 'single',
    children: 0
  });

  const [incomeData, setIncomeData] = useState<IncomeData>({
    salary: 0,
    freelance: 0,
    investments: 0,
    other: 0,
    total: 0
  });

  const [deductionData, setDeductionData] = useState<DeductionData>({
    workExpenses: 0,
    donations: 0,
    healthInsurance: 0,
    education: 0,
    other: 0,
    total: 0
  });

  const [taxDeclaration, setTaxDeclaration] = useState<TaxDeclaration | null>(null);
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    // Auto-populate data from analyzed documents
    populateFromDocuments();
  }, [documents]);

  useEffect(() => {
    // Calculate totals
    const incomeTotal = incomeData.salary + incomeData.freelance + incomeData.investments + incomeData.other;
    const deductionTotal = deductionData.workExpenses + deductionData.donations + deductionData.healthInsurance + deductionData.education + deductionData.other;
    
    setIncomeData(prev => ({ ...prev, total: incomeTotal }));
    setDeductionData(prev => ({ ...prev, total: deductionTotal }));
  }, [incomeData.salary, incomeData.freelance, incomeData.investments, incomeData.other, deductionData.workExpenses, deductionData.donations, deductionData.healthInsurance, deductionData.education, deductionData.other]);

  const populateFromDocuments = async () => {
    // Extract data from analyzed documents
    const analyzedDocs = documents.filter(doc => doc.analysis);
    
    let totalSalary = 0;
    let totalDonations = 0;
    let totalWorkExpenses = 0;

    analyzedDocs.forEach(doc => {
      if (doc.analysis) {
        doc.analysis.expertOpinion.potentialDeductions.forEach(deduction => {
          switch (deduction.category.toLowerCase()) {
            case 'donations':
            case 'charitable donations':
              totalDonations += deduction.amount;
              break;
            case 'work expenses':
            case 'business expenses':
              totalWorkExpenses += deduction.amount;
              break;
          }
        });

        // Extract salary information if available
        if (doc.analysis.documentType === 'salary' && doc.analysis.extractedData.grossSalary) {
          totalSalary += doc.analysis.extractedData.grossSalary;
        }
      }
    });

    setIncomeData(prev => ({ ...prev, salary: totalSalary }));
    setDeductionData(prev => ({ 
      ...prev, 
      donations: totalDonations,
      workExpenses: totalWorkExpenses
    }));
  };

  const generateTaxDeclaration = async () => {
    setGenerating(true);
    try {
      const declaration = await taxService.generateTaxDeclaration({
        personalInfo,
        incomeData,
        deductionData,
        documents: documents.filter(doc => doc.analysis)
      });
      setTaxDeclaration(declaration);
    } catch (error) {
      console.error('Error generating tax declaration:', error);
    } finally {
      setGenerating(false);
    }
  };

  const downloadDeclaration = async () => {
    if (!taxDeclaration) return;
    
    try {
      await taxService.downloadTaxDeclaration(taxDeclaration);
    } catch (error) {
      console.error('Error downloading tax declaration:', error);
    }
  };

  const steps = [
    { id: 1, title: 'Persönliche Daten', icon: User },
    { id: 2, title: 'Einkommensdaten', icon: Building },
    { id: 3, title: 'Abzüge', icon: Euro },
    { id: 4, title: 'Überprüfen & Generieren', icon: Calculator }
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Steuererklärungsgenerator</h2>
        <p className="text-gray-600 mb-6">
          Erstellen Sie Ihre vollständige Steuererklärung basierend auf Ihren hochgeladenen Dokumenten und zusätzlichen Informationen.
        </p>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  isActive ? 'bg-primary-600 text-white' :
                  isCompleted ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    isActive ? 'text-primary-600' :
                    isCompleted ? 'text-green-600' :
                    'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 ml-4 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Personal Information */}
      {currentStep === 1 && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Persönliche Daten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vorname</label>
              <input
                type="text"
                value={personalInfo.firstName}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nachname</label>
              <input
                type="text"
                value={personalInfo.lastName}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
              <textarea
                value={personalInfo.address}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, address: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Steuer-ID</label>
              <input
                type="text"
                value={personalInfo.taxId}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, taxId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Familienstand</label>
              <select
                value={personalInfo.maritalStatus}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, maritalStatus: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="single">Ledig</option>
                <option value="married">Verheiratet</option>
                <option value="divorced">Geschieden</option>
                <option value="widowed">Verwitwet</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Anzahl Kinder</label>
              <input
                type="number"
                min="0"
                value={personalInfo.children}
                onChange={(e) => setPersonalInfo(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-primary"
            >
              Weiter: Einkommensdaten
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Income Data */}
      {currentStep === 2 && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Income Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Salary Income</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeData.salary}
                  onChange={(e) => setIncomeData(prev => ({ ...prev, salary: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Freelance Income</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeData.freelance}
                  onChange={(e) => setIncomeData(prev => ({ ...prev, freelance: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Investment Income</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeData.investments}
                  onChange={(e) => setIncomeData(prev => ({ ...prev, investments: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Income</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeData.other}
                  onChange={(e) => setIncomeData(prev => ({ ...prev, other: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Income:</span>
              <span className="text-2xl font-bold text-green-600">€{incomeData.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep(1)}
              className="btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="btn-primary"
            >
              Next: Deductions
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Deductions */}
      {currentStep === 3 && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Tax Deductions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Building className="h-4 w-4 mr-2" />
                Work Expenses
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionData.workExpenses}
                  onChange={(e) => setDeductionData(prev => ({ ...prev, workExpenses: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <Heart className="h-4 w-4 mr-2" />
                Donations
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionData.donations}
                  onChange={(e) => setDeductionData(prev => ({ ...prev, donations: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Health Insurance</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionData.healthInsurance}
                  onChange={(e) => setDeductionData(prev => ({ ...prev, healthInsurance: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <GraduationCap className="h-4 w-4 mr-2" />
                Education Expenses
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionData.education}
                  onChange={(e) => setDeductionData(prev => ({ ...prev, education: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Other Deductions</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deductionData.other}
                  onChange={(e) => setDeductionData(prev => ({ ...prev, other: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Deductions:</span>
              <span className="text-2xl font-bold text-blue-600">€{deductionData.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button
              onClick={() => setCurrentStep(2)}
              className="btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="btn-primary"
            >
              Review & Generate
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Generate */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Review Your Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Total Income</h4>
                <p className="text-2xl font-bold text-blue-600">€{incomeData.total.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Total Deductions</h4>
                <p className="text-2xl font-bold text-green-600">€{deductionData.total.toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">Taxable Income</h4>
                <p className="text-2xl font-bold text-purple-600">€{(incomeData.total - deductionData.total).toFixed(2)}</p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={generateTaxDeclaration}
                disabled={generating}
                className="btn-primary flex items-center space-x-2 text-lg px-8 py-3"
              >
                <Calculator className="h-6 w-6" />
                <span>{generating ? 'Generating...' : 'Generate Tax Declaration'}</span>
              </button>
            </div>
          </div>

          {taxDeclaration && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="text-xl font-semibold text-green-900 mb-6">Tax Declaration Generated!</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Calculated Tax</h4>
                  <p className="text-2xl font-bold text-red-600">€{taxDeclaration.calculatedTax.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Expected Refund</h4>
                  <p className="text-2xl font-bold text-green-600">€{taxDeclaration.refundAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={downloadDeclaration}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Download className="h-5 w-5" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="btn-secondary"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaxDeclarationGenerator;