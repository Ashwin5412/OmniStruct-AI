import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
    HiOutlineArrowDownTray,
    HiOutlineArrowPath,
    HiOutlineTableCells,
    HiOutlineChartBar,
} from 'react-icons/hi2';
import DataTable from '../components/DataTable';
import ChatPanel from '../components/ChatPanel';
import { askQuestion, downloadDataset } from '../services/api';
import './PreviewPage.css';

export default function PreviewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { sessionId, columns, rows, summary, format } = location.state || {};

    const [chatLoading, setChatLoading] = useState(false);

    // If no data, redirect to upload
    if (!columns || !rows) {
        return (
            <div className="preview-empty container fade-in-up">
                <div className="empty-card glass-card">
                    <HiOutlineTableCells className="empty-icon" />
                    <h2>No Dataset Available</h2>
                    <p>Upload a PDF and extract a dataset first to see the preview here.</p>
                    <button className="btn-primary" onClick={() => navigate('/')}>
                        Go to Upload
                    </button>
                </div>
            </div>
        );
    }

    const handleChat = async (question) => {
        setChatLoading(true);
        try {
            const res = await askQuestion(sessionId, question);
            return res;
        } finally {
            setChatLoading(false);
        }
    };

    const handleDownload = () => {
        downloadDataset(sessionId, format);
    };

    return (
        <div className="preview-page container fade-in">
            {/* Header */}
            <div className="preview-header fade-in-up">
                <div className="preview-header-left">
                    <h1 className="preview-title">
                        <HiOutlineChartBar className="title-icon" />
                        <span className="gradient-text">Dataset Preview</span>
                    </h1>
                    {summary && <p className="preview-summary">{summary}</p>}
                </div>
                <div className="preview-actions">
                    <button className="btn-secondary" onClick={handleDownload} id="download-btn">
                        <HiOutlineArrowDownTray />
                        Download {format.toUpperCase()}
                    </button>
                    <button className="btn-secondary" onClick={() => navigate('/')} id="new-extraction-btn">
                        <HiOutlineArrowPath />
                        New Extraction
                    </button>
                </div>
            </div>

            {/* Content Grid */}
            <div className="preview-grid">
                {/* Table */}
                <div className="preview-table-section fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <DataTable columns={columns} rows={rows} />
                </div>

                {/* Chat */}
                <div className="preview-chat-section fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <ChatPanel onSend={handleChat} isLoading={chatLoading} />
                </div>
            </div>
        </div>
    );
}
