#!/usr/bin/env python3
"""
Simple PDF Extraction Service
Handles PDF text extraction reliably outside of serverless constraints
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import io
import logging
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'PDF Extraction Service',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/extract', methods=['POST'])
def extract_pdf_text():
    """Extract text from uploaded PDF"""
    try:
        logger.info('PDF extraction request received')
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check if it's a PDF
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'File must be a PDF'}), 400
        
        logger.info(f'Processing PDF: {file.filename}')
        
        # Read PDF content
        pdf_content = file.read()
        logger.info(f'PDF size: {len(pdf_content)} bytes')
        
        # Extract text using PyPDF2
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            
            # Extract text from all pages
            extracted_text = ""
            page_count = len(pdf_reader.pages)
            
            logger.info(f'PDF has {page_count} pages')
            
            for page_num in range(page_count):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                
                if page_text.strip():
                    extracted_text += page_text + "\n"
                    logger.info(f'Page {page_num + 1}: extracted {len(page_text)} characters')
                else:
                    logger.warning(f'Page {page_num + 1}: no text extracted')
            
            # Clean up the text
            extracted_text = extracted_text.strip()
            
            if extracted_text:
                logger.info(f'Successfully extracted {len(extracted_text)} characters total')
                
                return jsonify({
                    'success': True,
                    'filename': file.filename,
                    'pages': page_count,
                    'text_length': len(extracted_text),
                    'extracted_text': extracted_text,
                    'metadata': {
                        'title': pdf_reader.metadata.get('/Title', '') if pdf_reader.metadata else '',
                        'author': pdf_reader.metadata.get('/Author', '') if pdf_reader.metadata else '',
                        'subject': pdf_reader.metadata.get('/Subject', '') if pdf_reader.metadata else ''
                    }
                })
            else:
                logger.warning('No text could be extracted from PDF')
                return jsonify({
                    'success': False,
                    'error': 'No text found in PDF',
                    'filename': file.filename,
                    'pages': page_count,
                    'text_length': 0,
                    'extracted_text': '',
                    'suggestion': 'PDF may be scanned or image-based. OCR processing required.'
                })
                
        except Exception as pdf_error:
            logger.error(f'PDF processing error: {pdf_error}')
            return jsonify({
                'success': False,
                'error': f'PDF processing failed: {str(pdf_error)}',
                'filename': file.filename
            }), 500
            
    except Exception as e:
        logger.error(f'Request processing error: {e}')
        return jsonify({'error': f'Request processing failed: {str(e)}'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)