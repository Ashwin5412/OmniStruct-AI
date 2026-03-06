import { useState, useRef, useEffect } from 'react';
import {
    HiOutlineBars3,
    HiOutlinePaperClip,
    HiOutlineArrowUp,
    HiOutlineSparkles,
    HiOutlineUser,
    HiOutlineXMark,
    HiOutlineDocumentText,
    HiOutlineArrowDownTray,
    HiOutlineTableCells,
    HiOutlineCodeBracket,
    HiOutlineDocumentChartBar,
} from 'react-icons/hi2';
import { uploadAndExtract, askQuestion, downloadDataset } from '../services/api';
import './ChatArea.css';

const FORMAT_OPTIONS = [
    { id: 'json', label: 'JSON', icon: <HiOutlineCodeBracket /> },
    { id: 'csv', label: 'CSV', icon: <HiOutlineTableCells /> },
    { id: 'excel', label: 'Excel', icon: <HiOutlineDocumentChartBar /> },
];

const SUGGESTIONS = [
    'Extract all tables and structured data from this document',
    'Pull out key findings with authors, dates, and conclusions',
    'Extract numerical data with column headers and units',
    'List all entities, relationships, and attributes mentioned',
];

export default function ChatArea({ conversation, sidebarOpen, onToggleSidebar, onConversationCreated }) {
    const [messages, setMessages] = useState(conversation?.messages || []);
    const [input, setInput] = useState('');
    const [file, setFile] = useState(null);
    const [format, setFormat] = useState('json');
    const [showFormatPicker, setShowFormatPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(conversation?.sessionId || null);
    const [datasetReady, setDatasetReady] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const handleFileSelect = (e) => {
        const selected = e.target.files[0];
        if (selected && selected.type === 'application/pdf') {
            setFile(selected);
        }
        e.target.value = '';
    };

    const handleSend = async () => {
        const prompt = input.trim();
        if (!prompt) return;
        if (loading) return;

        // If we already have a dataset, this is a follow-up question
        if (datasetReady && sessionId) {
            const userMsg = { role: 'user', content: prompt };
            setMessages((prev) => [...prev, userMsg]);
            setInput('');
            setLoading(true);

            try {
                const res = await askQuestion(sessionId, prompt);
                setMessages((prev) => [
                    ...prev,
                    { role: 'ai', content: res?.answer || res || 'I couldn\'t process that question.' },
                ]);
            } catch {
                setMessages((prev) => [
                    ...prev,
                    { role: 'ai', content: 'Sorry, something went wrong. Please try again.' },
                ]);
            } finally {
                setLoading(false);
            }
            return;
        }

        // First message — needs a file
        if (!file) {
            setMessages((prev) => [
                ...prev,
                { role: 'user', content: prompt },
                { role: 'ai', content: 'Please attach a PDF file first. Click the 📎 button to upload your document.' },
            ]);
            return;
        }

        // Extract dataset
        const userMsg = {
            role: 'user',
            content: prompt,
            attachment: { name: file.name, size: formatFileSize(file.size) },
            format,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const result = await uploadAndExtract(file, prompt, format);
            setSessionId(result.sessionId);
            setDatasetReady(true);

            const aiMsg = {
                role: 'ai',
                content: result.summary || 'I\'ve successfully extracted the dataset from your document.',
                dataset: {
                    columns: result.columns,
                    rows: result.rows,
                    format,
                    sessionId: result.sessionId,
                },
            };
            setMessages((prev) => [...prev, aiMsg]);

            if (!conversation) {
                onConversationCreated({
                    id: result.sessionId || Date.now(),
                    title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
                    messages: [...messages, userMsg, aiMsg],
                    sessionId: result.sessionId,
                });
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    content: `Failed to process the document: ${err.response?.data?.message || err.message || 'Unknown error'}. Please check that your backend is running and try again.`,
                },
            ]);
        } finally {
            setLoading(false);
            setFile(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestion = (text) => {
        setInput(text);
        textareaRef.current?.focus();
    };

    const handleDownload = (ds) => {
        downloadDataset(ds.sessionId, ds.format);
    };

    const isWelcomeScreen = messages.length === 0;

    return (
        <div className="chat-area">
            {/* Top Bar */}
            <div className="chat-topbar">
                {!sidebarOpen && (
                    <button className="topbar-btn" onClick={onToggleSidebar} title="Open sidebar">
                        <HiOutlineBars3 />
                    </button>
                )}
                <span className="topbar-title">DataSynth AI</span>
                <div className="topbar-format">
                    <button
                        className="format-toggle"
                        onClick={() => setShowFormatPicker(!showFormatPicker)}
                        title="Output format"
                    >
                        {FORMAT_OPTIONS.find((f) => f.id === format)?.icon}
                        <span>{format.toUpperCase()}</span>
                    </button>
                    {showFormatPicker && (
                        <div className="format-dropdown">
                            {FORMAT_OPTIONS.map((f) => (
                                <button
                                    key={f.id}
                                    className={`format-option ${format === f.id ? 'active' : ''}`}
                                    onClick={() => { setFormat(f.id); setShowFormatPicker(false); }}
                                >
                                    {f.icon}
                                    <span>{f.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="chat-messages-area">
                <div className="chat-messages-inner">
                    {isWelcomeScreen ? (
                        <div className="welcome fade-in">
                            <div className="welcome-icon">
                                <HiOutlineSparkles />
                            </div>
                            <h1 className="welcome-title">What dataset do you need?</h1>
                            <p className="welcome-desc">
                                Upload a PDF and describe the data you want to extract. I'll synthesize a structured dataset for you.
                            </p>
                            <div className="suggestions">
                                {SUGGESTIONS.map((s, i) => (
                                    <button
                                        key={i}
                                        className="suggestion-chip"
                                        onClick={() => handleSuggestion(s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {messages.map((msg, i) => (
                                <div key={i} className={`message ${msg.role}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="message-avatar">
                                        {msg.role === 'ai' ? <HiOutlineSparkles /> : <HiOutlineUser />}
                                    </div>
                                    <div className="message-body">
                                        <span className="message-role">{msg.role === 'ai' ? 'DataSynth AI' : 'You'}</span>

                                        {/* Attachment badge */}
                                        {msg.attachment && (
                                            <div className="message-attachment">
                                                <HiOutlineDocumentText />
                                                <span>{msg.attachment.name}</span>
                                                <span className="att-size">{msg.attachment.size}</span>
                                                {msg.format && <span className="att-format">{msg.format.toUpperCase()}</span>}
                                            </div>
                                        )}

                                        <div className="message-text">{msg.content}</div>

                                        {/* Dataset table */}
                                        {msg.dataset && (
                                            <div className="message-dataset">
                                                <div className="dataset-header">
                                                    <span className="dataset-meta">
                                                        {msg.dataset.rows.length} rows · {msg.dataset.columns.length} columns
                                                    </span>
                                                    <button className="dataset-download" onClick={() => handleDownload(msg.dataset)}>
                                                        <HiOutlineArrowDownTray />
                                                        Download {msg.dataset.format.toUpperCase()}
                                                    </button>
                                                </div>
                                                <div className="dataset-table-wrap">
                                                    <table className="dataset-table">
                                                        <thead>
                                                            <tr>
                                                                <th>#</th>
                                                                {msg.dataset.columns.map((col, ci) => (
                                                                    <th key={ci}>{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {msg.dataset.rows.slice(0, 10).map((row, ri) => (
                                                                <tr key={ri}>
                                                                    <td className="row-num">{ri + 1}</td>
                                                                    {msg.dataset.columns.map((col, ci) => (
                                                                        <td key={ci}>{row[col] ?? row[ci] ?? '—'}</td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {msg.dataset.rows.length > 10 && (
                                                    <p className="dataset-more">
                                                        Showing 10 of {msg.dataset.rows.length} rows. Download for full data.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Loading indicator */}
                            {loading && (
                                <div className="message ai fade-in">
                                    <div className="message-avatar">
                                        <HiOutlineSparkles />
                                    </div>
                                    <div className="message-body">
                                        <span className="message-role">DataSynth AI</span>
                                        <div className="typing-dots">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Bar */}
            <div className="chat-input-area">
                <div className="input-container">
                    {/* File attachment chip */}
                    {file && (
                        <div className="file-chip">
                            <HiOutlineDocumentText />
                            <span className="file-chip-name">{file.name}</span>
                            <span className="file-chip-size">{formatFileSize(file.size)}</span>
                            <button className="file-chip-remove" onClick={() => setFile(null)}>
                                <HiOutlineXMark />
                            </button>
                        </div>
                    )}

                    <div className="input-row">
                        <button
                            className="attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach PDF"
                        >
                            <HiOutlinePaperClip />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />

                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            placeholder={datasetReady ? 'Ask a question about the dataset...' : 'Describe the dataset you want to extract...'}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={loading}
                        />

                        <button
                            className={`send-btn ${input.trim() ? 'active' : ''}`}
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            title="Send"
                        >
                            <HiOutlineArrowUp />
                        </button>
                    </div>
                </div>
                <p className="input-disclaimer">
                    DataSynth AI extracts datasets using multi-agent AI with explainable linkage.
                </p>
            </div>
        </div>
    );
}
