import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Document } from '../types';
import { documentService } from '../services/documentService';

interface DocumentUploadProps {
  documents: Document[];
  onDocumentUpload: (documents: Document[]) => void;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ documents, onDocumentUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    const newDocuments: Document[] = [];

    for (const file of acceptedFiles) {
      try {
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
        
        const document = await documentService.uploadDocument(file, (progress) => {
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        });
        
        newDocuments.push(document);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
    }

    onDocumentUpload(newDocuments);
    setUploading(false);
    setUploadProgress({});
  }, [onDocumentUpload]);

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
            <h3 className="font-medium text-gray-900">Dateien werden hochgeladen...</h3>
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
                  <div>
                    <h4 className="font-medium text-gray-900">{doc.name}</h4>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.size)} • Hochgeladen am {new Date(doc.uploadDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {doc.analysis ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
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