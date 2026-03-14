import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { HiOutlineDocumentArrowUp, HiOutlineDocumentText, HiOutlineXMark } from 'react-icons/hi2';
import './FileUpload.css';

export default function FileUpload({ files = [], onFilesSelect, onFileClear }) {
    const onDrop = useCallback(
        (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                onFilesSelect([...files, ...acceptedFiles]);
            }
        },
        [files, onFilesSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg']
        },
        multiple: true,
    });

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    return (
        <div className="file-upload-container">
            {files.length > 0 && (
                <div className="files-selected-list">
                    {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="file-selected glass-card fade-in">
                            <div className="file-info">
                                <div className="file-icon">
                                    <HiOutlineDocumentText />
                                </div>
                                <div className="file-details">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatSize(file.size)}</span>
                                </div>
                            </div>
                            <button className="file-remove" onClick={() => onFileClear(index)} title="Remove file">
                                <HiOutlineXMark />
                            </button>
                        </div>
                    ))}
                </div>
            )}

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
                        {isDragActive ? 'Drop your documents here' : 'Upload Documents'}
                    </h3>
                    <p className="dropzone-desc">
                        Drag & drop files here, or <span className="dropzone-link">browse files</span>
                    </p>
                    <p className="dropzone-hint">Supports PDF, Excel, CSV, Word, & Images up to 50 MB</p>
                </div>
            </div>
        </div>
    );
}


