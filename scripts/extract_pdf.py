#!/usr/bin/env python3
"""
Simple PDF text extraction script using PyPDF2
Can be called from Node.js backend
"""

import sys
import json
import PyPDF2
import io
import base64

def extract_pdf_text(pdf_data):
    """Extract text from PDF data using PyPDF2"""
    try:
        # Create PDF reader from bytes
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_data))
        
        # Extract text from all pages
        extracted_text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            
            if page_text.strip():
                extracted_text += page_text + "\n"
        
        return {
            'success': True,
            'text': extracted_text.strip(),
            'pages': len(pdf_reader.pages),
            'text_length': len(extracted_text.strip())
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'text': '',
            'pages': 0,
            'text_length': 0
        }

def main():
    """Main function - reads base64 PDF data from stdin and outputs JSON"""
    try:
        # Read base64 encoded PDF data from stdin
        input_data = sys.stdin.read().strip()
        
        if not input_data:
            print(json.dumps({
                'success': False,
                'error': 'No input data provided',
                'text': '',
                'pages': 0,
                'text_length': 0
            }))
            sys.exit(1)
        
        # Decode base64 data
        try:
            pdf_data = base64.b64decode(input_data)
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': f'Invalid base64 data: {str(e)}',
                'text': '',
                'pages': 0,
                'text_length': 0
            }))
            sys.exit(1)
        
        # Extract text
        result = extract_pdf_text(pdf_data)
        
        # Output JSON result
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}',
            'text': '',
            'pages': 0,
            'text_length': 0
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()