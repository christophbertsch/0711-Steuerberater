import { useState, useEffect } from 'react';
import { Cloud, Upload, RefreshCw, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { documentService } from '../services/documentService';

interface BlobFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

interface MigrationResult {
  message: string;
  migratedFiles: Array<{
    originalPath: string;
    blobUrl: string;
    fileName: string;
    size: number;
  }>;
}

export default function BlobStorageManager() {
  const [blobFiles, setBlobFiles] = useState<BlobFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBlobFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const files = await documentService.listBlobFiles();
      setBlobFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blob files');
    } finally {
      setLoading(false);
    }
  };

  const migrateFiles = async () => {
    setMigrating(true);
    setError(null);
    setMigrationResult(null);
    try {
      const result = await documentService.migrateLocalFiles();
      setMigrationResult(result);
      // Refresh the blob files list after migration
      await loadBlobFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    loadBlobFiles();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Cloud className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Vercel Blob Storage Manager</h2>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={loadBlobFiles}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
              <button
                onClick={migrateFiles}
                disabled={migrating}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Database className={`h-4 w-4 mr-2 ${migrating ? 'animate-pulse' : ''}`} />
                {migrating ? 'Migriere...' : 'Lokale Dateien migrieren'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {migrationResult && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-green-800 font-medium">{migrationResult.message}</span>
              </div>
              {migrationResult.migratedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-green-700 mb-2">Migrierte Dateien:</p>
                  <ul className="text-sm text-green-600 space-y-1">
                    {migrationResult.migratedFiles.map((file, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{file.fileName}</span>
                        <span>{formatFileSize(file.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Dateien in Vercel Blob Storage ({blobFiles.length})
            </h3>
            <p className="text-sm text-gray-600">
              Hier werden alle Dateien angezeigt, die in Ihrem Vercel Blob Storage gespeichert sind.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Lade Dateien...</span>
            </div>
          ) : blobFiles.length === 0 ? (
            <div className="text-center py-8">
              <Cloud className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Keine Dateien in Blob Storage gefunden</p>
              <p className="text-sm text-gray-400 mt-2">
                Laden Sie Dokumente hoch oder migrieren Sie lokale Dateien
              </p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datei
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Größe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hochgeladen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blobFiles.map((file, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Upload className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-sm font-medium text-gray-900">
                            {file.pathname.split('/').pop()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(file.uploadedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate block max-w-xs"
                        >
                          {file.url}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Hinweise zur Vercel Blob Storage Integration</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Dateien werden jetzt in Vercel Blob Storage gespeichert statt lokal</li>
          <li>• Dies löst das Problem der Datenpersistenz bei lokaler Entwicklung</li>
          <li>• Verwenden Sie die Migration-Funktion, um bestehende lokale Dateien zu übertragen</li>
          <li>• Stellen Sie sicher, dass BLOB_READ_WRITE_TOKEN in Ihren Umgebungsvariablen gesetzt ist</li>
        </ul>
      </div>
    </div>
  );
}