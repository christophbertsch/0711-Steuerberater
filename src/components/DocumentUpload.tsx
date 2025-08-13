import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { Document } from '../types';
import { documentService } from '../services/documentService';
import { documentProcessor, ProcessedDocument } from '../services/documentProcessor';

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUpload: (documents: Document[]) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ documents, onDocumentUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [processingStatus, setProcessingStatus] = useState<Record<string, string>>({});
  const [reprocessing, setReprocessing] = useState<Record<string, boolean>>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    const newDocuments: Document[] = [];

    for (const file of acceptedFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        setProcessingStatus(prev => ({ ...prev, [file.name]: 'Uploading...' }));
        
        // Use the enhanced document processor
        const processedDocument = await documentProcessor.processDocument(file);
        
        newDocuments.push(processedDocument);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        setProcessingStatus(prev => ({ ...prev, [file.name]: 'Completed' }));
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        setProcessingStatus(prev => ({ ...prev, [file.name]: 'Failed' }));
        
        // Fallback to basic upload if processing fails
        try {
          const document = await documentService.uploadDocument(file, (progress) => {
            setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
          });
          newDocuments.push(document);
          setProcessingStatus(prev => ({ ...prev, [file.name]: 'Basic upload completed' }));
        } catch (fallbackError) {
          console.error(`Fallback upload also failed for ${file.name}:`, fallbackError);
        }
      }
    }

    onDocumentUpload(newDocuments);
    setUploading(false);
    setUploadProgress({});
    setProcessingStatus({});
  }, [onDocumentUpload]);

  const reprocessDocument = async (documentId: string, useOCR: boolean = false) => {
    setReprocessing(prev => ({ ...prev, [documentId]: true }));
    
    try {
      const reprocessedDoc = await documentProcessor.reprocessDocument(documentId, {
        useOCR,
        enhancedExtraction: true
      });
      
      // Update the document in the list
      const updatedDocuments = documents.map(doc => 
        doc.id === documentId ? { ...doc, ...reprocessedDoc } : doc
      );
      onDocumentUpload(updatedDocuments);
      
    } catch (error) {
      console.error('Error reprocessing document:', error);
    } finally {
      setReprocessing(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/xml': ['.xml'],
      'application/xml': ['.xml']
    },
    multiple: true
  });

  const removeDocument = (documentId: string) => {
    // This would typically call a service to remove the document
    console.log('Remove document:', documentId);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <Image className="h-8 w-8 text-blue-500" />;
    return <FileText className="h-8 w-8 text-red-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Steuerdokumente hochladen</h2>
        <p className="text-gray-600 mb-6">
          Laden Sie Ihre steuerbezogenen Dokumente hoch, einschließlich Belege, Rechnungen, Steuerformulare, 
          Gehaltsabrechnungen und Spendenbescheinigungen. Unsere KI wird sie analysieren und Ihnen 
          fachkundige Steuer- und Rechtsgutachten liefern.
        </p>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-lg text-primary-600">Dateien hier ablegen...</p>
          ) : (
            <div>
              <p className="text-lg text-gray-600 mb-2">
                Dateien hierher ziehen oder klicken zum Auswählen
              </p>
              <p className="text-sm text-gray-500">
                Unterstützt PDF, Bilder, Word-Dokumente und XML-Dateien
              </p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-4 space-y-2">
            <h3 className="font-medium text-gray-900">Dateien werden verarbeitet...</h3>
            {Object.entries(uploadProgress).map(([filename, progress]) => (
              <div key={filename} className="flex items-center space-x-3">
                <span className="text-sm text-gray-600 flex-1">{filename}</span>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm text-gray-500">{progress}%</span>
                <span className="text-xs text-gray-400">
                  {processingStatus[filename] || 'Processing...'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Hochgeladene Dokumente ({documents.length})
          </h3>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(doc.type)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{doc.name}</h4>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.size)} • Hochgeladen am {new Date(doc.uploadDate).toLocaleDateString()}
                    </p>
                    
                    {/* Content analysis info */}
                    {(doc as ProcessedDocument).contentAnalysis && (
                      <div className="mt-1 flex items-center space-x-2 text-xs">
                        <span className={`px-2 py-1 rounded-full ${
                          (doc as ProcessedDocument).contentAnalysis.hasText 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {(doc as ProcessedDocument).contentAnalysis.hasText ? 'Text erkannt' : 'Kein Text'}
                        </span>
                        
                        {(doc as ProcessedDocument).contentAnalysis.language !== 'unknown' && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            {(doc as ProcessedDocument).contentAnalysis.language.toUpperCase()}
                          </span>
                        )}
                        
                        {(doc as ProcessedDocument).contentAnalysis.isScanned && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                            Gescannt
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Text preview */}
                    {(doc as ProcessedDocument).extractedText && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-20 overflow-y-auto">
                        <strong>Textvorschau:</strong><br />
                        {(doc as ProcessedDocument).extractedText.substring(0, 200)}
                        {(doc as ProcessedDocument).extractedText.length > 200 && '...'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {(doc as ProcessedDocument).contentAnalysis ? (
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-xs text-green-600">
                        {Math.round(((doc as ProcessedDocument).contentAnalysis.confidence * 100))}% confident
                      </span>
                    </div>
                  ) : doc.analysis ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                  
                  {/* Reprocess button */}
                  <button
                    onClick={() => reprocessDocument(doc.id, false)}
                    disabled={reprocessing[doc.id]}
                    className="p-1 text-blue-400 hover:text-blue-600 disabled:opacity-50"
                    title="Reprocess document"
                  >
                    <RefreshCw className={`h-4 w-4 ${reprocessing[doc.id] ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {/* OCR reprocess button for images and scanned PDFs */}
                  {(doc.type.startsWith('image/') || 
                    ((doc as ProcessedDocument).contentAnalysis?.isScanned)) && (
                    <button
                      onClick={() => reprocessDocument(doc.id, true)}
                      disabled={reprocessing[doc.id]}
                      className="p-1 text-purple-400 hover:text-purple-600 disabled:opacity-50"
                      title="Reprocess with OCR"
                    >
                      <Eye className={`h-4 w-4 ${reprocessing[doc.id] ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Unterstützte Dokumenttypen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-medium mb-2">Steuerformulare & Amtliche Dokumente</h4>
            <ul className="space-y-1">
              <li>• Einkommensteuererklärungen (ESt-Formulare)</li>
              <li>• Lohnsteuerbescheinigungen</li>
              <li>• Steuerbescheide</li>
              <li>• Amtliche Korrespondenz</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Belege & Rechnungen</h4>
            <ul className="space-y-1">
              <li>• Betriebsausgaben</li>
              <li>• Medizinische Ausgaben</li>
              <li>• Spendenbescheinigungen</li>
              <li>• Bildungsausgaben</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUpload;