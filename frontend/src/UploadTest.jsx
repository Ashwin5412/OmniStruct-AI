import React, { useState } from 'react';
import axios from 'axios';
import { uploadFiles } from './api';
import './UploadTest.css';

const UploadTest = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadStatus, setUploadStatus] = useState('');
    const [dataset, setDataset] = useState([]);
    const [query, setQuery] = useState('');
    const [format, setFormat] = useState('json');
    const [generationStatus, setGenerationStatus] = useState('');

    const handleFileChange = (e) => {
        setSelectedFiles(e.target.files);
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;
        setUploadStatus('Uploading and extracting in parallel...');
        try {
            const result = await uploadFiles(selectedFiles);
            setUploadStatus(`Success: Processed ${result.details.length} files.`);
        } catch (error) {
            setUploadStatus(`Error: ${error.message}`);
        }
    };

    const handleGenerateDataset = async () => {
        if (!query) return;
        setGenerationStatus('Extracting and formatting data...');
        
        try {
            const response = await axios.post('http://127.0.0.1:8000/generate-dataset', {
                prompt: query,
                format: format
            });
            
            const result = response.data;
            
            if (result.format === 'csv') {
                const blob = new Blob([result.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'extracted_dataset.csv';
                a.click();
                setGenerationStatus('CSV downloaded successfully!');
            } 
            else {
                setDataset(prev => [...prev, { 
                    answer: JSON.stringify(result.data, null, 2), 
                    audit_trail: result.audit_trail 
                }]);
                setGenerationStatus('Dataset generated successfully!');
            }
            setQuery('');
        } catch (error) {
            setGenerationStatus(`Error: ${error.message}`);
        }
    };

    return (
        <div className="container">
            <h2>Data Ingestion & xAI Preview</h2>
            
            <div className="upload-section">
                <input type="file" multiple onChange={handleFileChange} />
                <button onClick={handleUpload}>Upload Multiple Files</button>
                <p className="status-text">{uploadStatus}</p>
            </div>

            <div className="query-section">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., Extract all invoice numbers and totals into a dataset..."
                />
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="json">Preview as JSON</option>
                    <option value="csv">Download as CSV</option>
                    <option value="excel">Download as Excel</option>
                </select>
                <button onClick={handleGenerateDataset}>Generate Dataset</button>
            </div>
            <p className="status-text">{generationStatus}</p>

            {dataset.length > 0 && (
                <div className="preview-section">
                    <h3>Synthesized Dataset Preview</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Extracted Data</th>
                                <th>Authenticity Link (xAI)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dataset.map((row, index) => (
                                <tr key={index}>
                                    <td><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.answer}</pre></td>
                                    <td className="center-align">
                                        <div className="tooltip-container">
                                            <span className="info-icon">🔗 Source</span>
                                            <div className="tooltip-content">
                                                <strong>Audit Trail:</strong>
                                                {row.audit_trail.map((audit, i) => (
                                                    <div key={i} className="audit-item">
                                                        📄 {audit.source.split('/').pop()} <br/>
                                                        {audit.page ? `📍 Page: ${audit.page}` : `📊 Format: ${audit.format}`}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UploadTest;