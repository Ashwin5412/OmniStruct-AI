import React, { useState } from 'react';
import axios from 'axios';

const ExtractView = ({ 
    selectedFiles, setSelectedFiles, 
    dataset, setDataset, 
    format, setFormat,
    setCurrentView 
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [prompt, setPrompt] = useState('');

    // --- 1. HANDLE FILE SELECTION ---
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...files]);
        setUploadStatus(''); // Reset status when new files are added
    };

    const removeFile = (indexToRemove) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setUploadStatus('');
    };

    // --- 2. UPLOAD TO FASTAPI ---
    const handleUploadToDB = async () => {
        if (selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadStatus('Uploading and Vectorizing...');

        const formData = new FormData();
        selectedFiles.forEach(file => formData.append('files', file));

        try {
            const response = await axios.post('http://127.0.0.1:8000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadStatus(`✅ Successfully processed ${response.data.details.length} files into ChromaDB.`);
        } catch (error) {
            console.error("Upload error:", error);
            setUploadStatus('❌ Error uploading files. Is the backend running?');
        } finally {
            setIsUploading(false);
        }
    };

    // --- 3. GENERATE DATASET ---
    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!prompt) return;
        
        setIsGenerating(true);
        setDataset(null); // Clear old dataset

        try {
            const response = await axios.post('http://127.0.0.1:8000/generate-dataset', {
                prompt: prompt,
                format: format
            });

            // Map the backend JSON to our table format
            const jsonData = response.data.json_data || [];
            if (jsonData.length > 0) {
                setDataset({
                    format: response.data.format,
                    file_data: response.data.file_data,
                    audit_trail: response.data.audit_trail,
                    headers: Object.keys(jsonData[0]),
                    rows: jsonData
                });
            } else {
                alert("The AI couldn't find any matching data in the documents.");
            }
        } catch (error) {
            console.error("Generation error:", error);
            alert("Error generating dataset. Check your FastAPI terminal for crash logs.");
        } finally {
            setIsGenerating(false);
        }
    };

    // --- 4. DOWNLOAD HANDLER ---
    const handleDownload = () => {
        if (!dataset || !dataset.file_data) return;
        
        let blob;
        let filename = `dataset.${dataset.format}`;

        if (['npy', 'h5'].includes(dataset.format)) {
            const byteCharacters = atob(dataset.file_data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: 'application/octet-stream' });
        } else if (dataset.format === 'csv') {
            blob = new Blob([dataset.file_data], { type: 'text/csv' });
        } else if (dataset.format === 'xml') {
            blob = new Blob([dataset.file_data], { type: 'application/xml' });
        } else {
            blob = new Blob([JSON.stringify(dataset.rows, null, 2)], { type: 'application/json' });
            filename = 'dataset.json';
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    return (
        <div className="h-full overflow-y-auto p-8 w-full custom-scrollbar">
            <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
                
                {/* Header */}
                <div className="text-center space-y-2 mt-4">
                    <h1 className="text-3xl font-bold text-gray-100 tracking-tight">Synthesize Your Data</h1>
                    <p className="text-gray-400 text-sm">Upload unstructured files and let AI build a structured dataset.</p>
                </div>

                {/* Upload Zone */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center transition-all hover:border-emerald-500/30 shadow-lg relative group">
                    <input type="file" multiple id="file-upload" className="hidden" onChange={handleFileChange} />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 bg-gray-800 group-hover:bg-gray-700 transition-colors rounded-full flex items-center justify-center text-3xl shadow-inner">📁</div>
                        <span className="text-gray-300 font-medium group-hover:text-emerald-400 transition-colors text-lg">Click to Add Documents</span>
                    </label>

                    {selectedFiles.length > 0 && (
                        <div className="mt-6">
                            <div className="flex flex-wrap justify-center gap-3 mb-4">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-gray-800 text-gray-300 px-4 py-2 rounded-full text-sm border border-gray-700 shadow-sm">
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        <button onClick={() => removeFile(idx)} className="text-gray-500 hover:text-red-400 font-bold transition-colors">×</button>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Real Upload Button */}
                            <button 
                                onClick={handleUploadToDB} 
                                disabled={isUploading}
                                className="bg-gray-700 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md disabled:opacity-50"
                            >
                                {isUploading ? '⚙️ Processing...' : 'Upload to OmniStruct-AI'}
                            </button>
                            {uploadStatus && <p className="mt-3 text-sm text-emerald-400">{uploadStatus}</p>}
                        </div>
                    )}
                </div>

                {/* Query Input */}
                <form onSubmit={handleGenerate} className="bg-gray-900 border border-gray-800 rounded-xl p-2 flex items-center shadow-xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Extract all patient names, ages, and medical diagnoses..." 
                        className="flex-1 bg-transparent border-none outline-none text-gray-200 px-4 py-3 placeholder-gray-600 text-lg"
                        disabled={isGenerating}
                    />
                    
                    <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 mr-3 px-2 transition-colors hover:border-gray-600">
                        <span className="text-gray-500 pl-2 text-sm font-medium hidden sm:inline-block">Format:</span>
                        <select 
                            value={format} 
                            onChange={(e) => setFormat(e.target.value)}
                            className="bg-transparent text-gray-200 text-base font-medium border-none rounded-lg px-2 py-2.5 outline-none cursor-pointer hover:text-emerald-400 transition-colors appearance-none text-center min-w-[70px]"
                            disabled={isGenerating}
                        >
                            <option value="csv" className="bg-gray-800 text-white">CSV</option>
                            <option value="json" className="bg-gray-800 text-white">JSON</option>
                            <option value="xml" className="bg-gray-800 text-white">XML</option>
                            <option value="npy" className="bg-gray-800 text-white">NPY</option>
                            <option value="h5" className="bg-gray-800 text-white">H5</option>
                        </select>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isGenerating}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 px-6 rounded-lg font-medium transition-all shadow-md text-lg flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{isGenerating ? '⚙️' : '⇧'}</span> 
                        {isGenerating ? 'Extracting...' : 'Generate'}
                    </button>
                </form>

                {/* Dataset Preview Area */}
                {dataset && (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/80">
                            <h3 className="text-lg font-semibold text-gray-200">Data Set Preview</h3>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleDownload}
                                    className="text-sm px-5 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700 font-medium"
                                >
                                    Download {format.toUpperCase()}
                                </button>
                                
                                <button 
                                    onClick={() => setCurrentView('chat')}
                                    className="text-sm px-5 py-2.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors border border-blue-500/30 font-medium flex items-center gap-2 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                >
                                    <span>💬</span> Chat with Data
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto w-full">
                            {['npy', 'h5'].includes(dataset.format) ? (
                                <div className="p-12 text-center text-gray-400">
                                    <div className="text-4xl mb-4">📦</div>
                                    <p className="text-lg font-medium text-gray-300">Binary ML Format Generated successfully.</p>
                                    <p className="text-sm mt-2">Click the download button above to save your <b>.{dataset.format}</b> file.</p>
                                </div>
                            ) : dataset.format === 'xml' ? (
                                <div className="p-6">
                                    <pre className="text-sm text-gray-300 bg-gray-950 p-4 rounded-lg overflow-x-auto border border-gray-800">
                                        {dataset.file_data}
                                    </pre>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm text-gray-400">
                                    <thead className="bg-gray-800/40 text-gray-300 uppercase font-medium text-xs tracking-wider">
                                        <tr>
                                            {dataset.headers.map((h, i) => <th key={i} className="px-6 py-4">{h}</th>)}
                                            <th className="px-6 py-4 text-center">Source</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {dataset.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-800/40 transition-colors">
                                                {dataset.headers.map((h, j) => (
                                                    <td key={j} className="px-6 py-4 whitespace-nowrap">{String(row[h])}</td>
                                                ))}
                                                <td className="px-6 py-4 text-center text-emerald-400 cursor-help" title={dataset.audit_trail?.[i]?.source || "Source Document"}>
                                                    🔗
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExtractView;