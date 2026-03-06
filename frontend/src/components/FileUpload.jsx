import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { HiOutlineDocumentArrowUp, HiOutlineDocumentText, HiOutlineXMark } from 'react-icons/hi2';
import './FileUpload.css';

export default function FileUpload({ file, onFileSelect, onFileClear }) {
    const onDrop = useCallback(
        (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                onFileSelect(acceptedFiles[0]);
            }
        },
        [onFileSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        multiple: false,
    });

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    if (file) {
        return (
            <div className="file-selected glass-card">
                <div className="file-info">
                    <div className="file-icon">
                        <HiOutlineDocumentText />
                    </div>
                    <div className="file-details">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatSize(file.size)}</span>
                    </div>
                </div>
                <button className="file-remove" onClick={onFileClear} title="Remove file">
                    <HiOutlineXMark />
                </button>
            </div>
        );
    }

    return (
        <div
            {...getRootProps()}
            className={`file-dropzone glass-card ${isDragActive ? 'drag-active' : ''}`}
        >
            <input {...getInputProps()} id="pdf-upload" />
            <div className="dropzone-content">
                <div className="dropzone-icon">
                    <HiOutlineDocumentArrowUp />
                </div>
                <h3 className="dropzone-title">
                    {isDragActive ? 'Drop your PDF here' : 'Upload PDF Document'}
                </h3>
                <p className="dropzone-desc">
                    Drag & drop a PDF file here, or <span className="dropzone-link">browse files</span>
                </p>
                <p className="dropzone-hint">Supports PDF files up to 50 MB</p>
            </div>
        </div>
    );
}
