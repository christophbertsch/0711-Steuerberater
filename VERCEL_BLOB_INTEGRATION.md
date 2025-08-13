# Vercel Blob Storage Integration

This document explains the integration of Vercel Blob Storage into the Tax & Law AI Expert application to solve data persistence issues when running locally or in different environments.

## 🎯 Problem Solved

Previously, uploaded documents were stored locally in the `uploads/` directory, which caused issues:
- Files were lost when running the application in different environments
- Local development didn't persist files between sessions
- Deployment environments had ephemeral storage

## 🔧 Solution: Vercel Blob Storage

We've integrated Vercel Blob Storage to provide persistent, cloud-based file storage that works across all environments.

## 📋 Setup Instructions

### 1. Get Your Vercel Blob Token

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Navigate to your project: `0711-steuerberater`
3. Go to **Storage** tab
4. Create a new Blob Store if you haven't already
5. Copy the `BLOB_READ_WRITE_TOKEN`

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Vercel Blob Storage (required for file uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token-here
```

### 3. Install Dependencies

The required dependency `@vercel/blob` has already been installed:

```bash
npm install @vercel/blob
```

## 🚀 Features

### New API Endpoints

1. **File Upload** (`POST /api/documents/upload`)
   - Now uploads files directly to Vercel Blob Storage
   - Returns blob URL and metadata

2. **List Blob Files** (`GET /api/blob/list`)
   - Lists all files in your Vercel Blob Storage
   - Shows file metadata (size, upload date, URL)

3. **Migrate Local Files** (`POST /api/blob/migrate`)
   - Migrates existing files from `uploads/` directory to Blob Storage
   - Useful for transitioning from local storage

4. **Delete Files** (`DELETE /api/documents/:id`)
   - Now properly deletes files from Blob Storage

### Frontend Integration

- **New Blob Storage Manager Tab**: Access via the "Blob Storage" tab in the UI
- **Migration Tool**: One-click migration of existing local files
- **File Browser**: View all files stored in Vercel Blob Storage
- **Real-time Updates**: Refresh and monitor your blob storage

## 🔄 Migration Process

### Automatic Migration

1. Navigate to the "Blob Storage" tab in the application
2. Click "Lokale Dateien migrieren" (Migrate Local Files)
3. The system will automatically upload all files from the `uploads/` directory to Vercel Blob Storage

### Manual Migration

If you need to migrate files manually:

```bash
curl -X POST http://localhost:56534/api/blob/migrate
```

## 📊 Data Structure Changes

### Document Interface Updates

The `Document` interface now includes blob storage fields:

```typescript
export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  filePath?: string; // Legacy field for backward compatibility
  blobUrl?: string; // Vercel Blob Storage URL
  blobPathname?: string; // Vercel Blob pathname
  content?: string;
  analysis?: DocumentAnalysis;
}
```

### Backward Compatibility

The system maintains backward compatibility:
- Existing documents with `filePath` continue to work
- New uploads use `blobUrl` and `blobPathname`
- AI analysis works with both storage methods

## 🛠️ Technical Implementation

### Server-Side Changes

1. **Multer Configuration**: Changed from disk storage to memory storage
2. **Upload Handler**: Now uploads to Vercel Blob instead of local filesystem
3. **Text Extraction**: Updated to fetch content from blob URLs
4. **File Deletion**: Integrated with Vercel Blob deletion API

### Client-Side Changes

1. **Document Service**: Added blob management methods
2. **Type Definitions**: Extended Document interface
3. **UI Components**: New Blob Storage Manager component
4. **Mock Responses**: Updated for development mode

## 🔒 Security Considerations

- Blob files are set to `public` access for AI processing
- The `BLOB_READ_WRITE_TOKEN` should be kept secure
- Files are organized in a `documents/` folder structure
- Unique filenames prevent conflicts

## 🧪 Testing

### Test File Upload

1. Start the application: `npm run server`
2. Navigate to "Dokumente hochladen"
3. Upload a test document
4. Check the "Blob Storage" tab to verify the file appears

### Test Migration

1. Ensure you have files in the `uploads/` directory
2. Navigate to "Blob Storage" tab
3. Click "Lokale Dateien migrieren"
4. Verify files appear in the blob storage list

## 🐛 Troubleshooting

### Common Issues

1. **"Vercel Blob Storage not configured"**
   - Ensure `BLOB_READ_WRITE_TOKEN` is set in your `.env` file
   - Restart the server after adding the token

2. **Upload fails**
   - Check your Vercel Blob Storage quota
   - Verify the token has read/write permissions

3. **Files not appearing**
   - Check the browser console for errors
   - Verify the API endpoints are responding correctly

### Debug Commands

```bash
# Check if blob token is configured
echo $BLOB_READ_WRITE_TOKEN

# Test blob list endpoint
curl http://localhost:56534/api/blob/list

# Test migration endpoint
curl -X POST http://localhost:56534/api/blob/migrate
```

## 📈 Benefits

1. **Persistent Storage**: Files persist across deployments and environments
2. **Scalability**: Vercel Blob Storage handles large files and high traffic
3. **Global CDN**: Fast file access from anywhere in the world
4. **Cost-Effective**: Pay only for what you use
5. **Easy Management**: Built-in UI for file management

## 🔮 Future Enhancements

- [ ] Implement file versioning
- [ ] Add file compression for PDFs
- [ ] Implement batch upload/download
- [ ] Add file sharing capabilities
- [ ] Integrate with OCR services for better text extraction

## 📞 Support

If you encounter issues with the Vercel Blob Storage integration:

1. Check the troubleshooting section above
2. Verify your Vercel Blob Storage configuration
3. Check the server logs for detailed error messages
4. Ensure all environment variables are properly set

---

**Note**: This integration maintains full backward compatibility with existing local file storage while providing a seamless transition to cloud-based storage.