import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
    HiOutlineArrowDownTray,
    HiOutlineArrowPath,
    HiOutlineTableCells,
    HiOutlineChartBar,
    HiOutlineLink,
    HiOutlineXMark
} from 'react-icons/hi2';
import DataTable from '../components/DataTable';
import ChatPanel from '../components/ChatPanel';
import { askQuestion, downloadDataset } from '../services/api';
import './PreviewPage.css';

export default function PreviewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { sessionId, columns, rows, summary, format, references } = location.state || {};

    const [chatLoading, setChatLoading] = useState(false);
    const [activeCitations, setActiveCitations] = useState(null);

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
                    {references && references.length > 0 && (
                        <button className="btn-secondary" onClick={() => setActiveCitations(references)} id="view-citations-btn">
                            <HiOutlineLink />
                            View Citations
                        </button>
                    )}
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

            {/* Citations Overlay */}
            {activeCitations && (
                <div className="citations-overlay">
                    <div className="citations-panel-backdrop" onClick={() => setActiveCitations(null)} />
                    <div className="citations-panel slide-in">
                        <div className="citations-panel-header">
                            <h3><HiOutlineLink /> Source Citations</h3>
                            <button className="panel-close" onClick={() => setActiveCitations(null)}>
                                <HiOutlineXMark />
                            </button>
                        </div>
                        <div className="citations-panel-content">
                            {activeCitations.map((ref, i) => (
                                <div key={i} className="citation-card">
                                    <div className="citation-meta">
                                        <span className="cit-source">{ref.source}</span>
                                        <span className="cit-page">Page {ref.page}</span>
                                    </div>
                                    <div className="citation-text">"{ref.content_preview}"</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
