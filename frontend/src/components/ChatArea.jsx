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
    HiOutlineLink,
    HiOutlinePlusCircle,
    HiOutlineMagnifyingGlass,
    HiOutlineCurrencyDollar,
    HiOutlineQuestionMarkCircle,
} from 'react-icons/hi2';
import { uploadAndExtract, askQuestion, downloadDataset } from '../services/api';
import './ChatArea.css';

const FORMAT_OPTIONS = [
    { id: 'json', label: 'JSON', icon: <HiOutlineCodeBracket /> },
    { id: 'csv', label: 'CSV', icon: <HiOutlineTableCells /> },
    { id: 'tsv', label: 'TSV', icon: <HiOutlineDocumentText /> },
    { id: 'excel', label: 'Excel', icon: <HiOutlineDocumentChartBar /> },
];

const SUGGESTIONS = [
    'What is my budget?',
    'How do I use this tool?',
    'Can I get training?',
];

export default function ChatArea({ conversation, sidebarOpen, onToggleSidebar, onConversationCreated }) {
    const [messages, setMessages] = useState(conversation?.messages || []);
    const [input, setInput] = useState('');
    const [files, setFiles] = useState([]);
    const [format, setFormat] = useState(conversation?.messages?.find(m => m.format)?.format || 'json');
    const [showFormatPicker, setShowFormatPicker] = useState(false);
    const [sessionId, setSessionId] = useState(conversation?.sessionId || conversation?.id || null);
    const [datasetReady, setDatasetReady] = useState(false);
    const [activeCitations, setActiveCitations] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMiniChat, setShowMiniChat] = useState(false);
    const [miniMessages, setMiniMessages] = useState([]);
    const [miniInput, setMiniInput] = useState('');
    const [miniLoading, setMiniLoading] = useState(false);
    const [miniPosition, setMiniPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Sync sessionId and datasetReady with conversation
    useEffect(() => {
        if (conversation) {
            setSessionId(conversation.sessionId || conversation.id);
            const hasDataset = conversation.messages?.some(m => m.dataset);
            setDatasetReady(hasDataset);
        } else {
            setSessionId(null);
            setDatasetReady(false);
        }
    }, [conversation]);

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
        const selected = Array.from(e.target.files);
        if (selected.length > 0) {
            setFiles((prev) => [...prev, ...selected]);
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
            if (files.length > 0) {
                 userMsg.attachment = { 
                     name: files.length > 1 ? `${files.length} files` : files[0].name, 
                     size: formatFileSize(files.reduce((acc, f) => acc + f.size, 0)) 
                 };
            }
            setMessages((prev) => [...prev, userMsg]);
            setInput('');
            setLoading(true);

            try {
                const res = await askQuestion(sessionId, prompt, files, format);
                const aiMsg = {
                    role: 'ai',
                    content: res?.answer || (typeof res === 'string' ? res : 'I couldn\'t process that question.')
                };
                
                if (res?.dataset) {
                     aiMsg.dataset = res.dataset;
                     aiMsg.content = res.answer + '\n\nI have updated the dataset with the new information.';
                }

                setMessages((prev) => [...prev, aiMsg]);
            } catch (err) {
                console.error("Chat error:", err);
                const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
                setMessages((prev) => [
                    ...prev,
                    { role: 'ai', content: `Sorry, I couldn't process your question: ${detail}. Please try again.` },
                ]);
            } finally {
                setLoading(false);
                setFiles([]);
            }
            return;
        }

        // First message — needs a file
        if (files.length === 0) {
            setMessages((prev) => [
                ...prev,
                { role: 'user', content: prompt },
                { role: 'ai', content: 'Please attach at least one document first. Click the 📎 button to upload your documents.' },
            ]);
            return;
        }

        // Extract dataset
        const userMsg = {
            role: 'user',
            content: prompt,
            attachment: { 
                name: files.length > 1 ? `${files.length} files` : files[0].name, 
                size: formatFileSize(files.reduce((acc, f) => acc + f.size, 0)) 
            },
            format,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const result = await uploadAndExtract(files, prompt, format);
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
                    references: result.references || [],
                },
                followUp: "You can now ask me any questions about this data, or click 'View Citations' to see the sources."
            };
            setMessages((prev) => [...prev, aiMsg]);

            if (!conversation) {
                onConversationCreated({
                    id: result.sessionId || Date.now(),
                    title: result.title || (prompt.slice(0, 40) + (prompt.length > 40 ? '...' : '')),
                    messages: [...messages, userMsg, aiMsg],
                    sessionId: result.sessionId,
                });
            }
        } catch (err) {
            console.error("Extraction error:", err);
            const detail = err.response?.data?.detail || err.response?.data?.message || err.message || 'Unknown error';
            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    content: `Failed to process the document: ${detail}. Please check your connection or AI provider credits and try again.`,
                },
            ]);
        } finally {
            setLoading(false);
            setFiles([]);
        }
    };

    const handleMiniSend = async () => {
        const prompt = miniInput.trim();
        if (!prompt || miniLoading || !sessionId) return;

        const userMsg = { role: 'user', content: prompt };
        setMiniMessages(prev => [...prev, userMsg]);
        setMiniInput('');
        setMiniLoading(true);

        try {
            const res = await askQuestion(sessionId, prompt);
            const aiMsg = {
                role: 'ai',
                content: res?.answer || (typeof res === 'string' ? res : 'I couldn\'t process that question.')
            };
            setMiniMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error("Mini Chat error:", err);
            const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
            setMiniMessages(prev => [
                ...prev,
                { role: 'ai', content: `Sorry, something went wrong: ${detail}. Please try again.` },
            ]);
        } finally {
            setMiniLoading(false);
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

    // --- Dragging Logic ---
    const handleMouseDown = (e) => {
        if (e.target.closest('.mini-close')) return;
        setIsDragging(true);
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            const newX = e.clientX - dragOffset.x;
            const newY = e.clientY - dragOffset.y;
            
            // Constrain to viewport (optional but recommended)
            const x = Math.max(0, Math.min(window.innerWidth - 400, newX));
            const y = Math.max(0, Math.min(window.innerHeight - 600, newY));
            
            setMiniPosition({ x, y });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const isWelcomeScreen = messages.length === 0;

    return (
        <div className={`chat-area ${sidebarOpen ? 'sidebar-open' : ''}`}>
            {/* Top Bar */}
            <div className="chat-topbar">
                <div className="topbar-left">
                    {!sidebarOpen && (
                        <button className="topbar-btn" onClick={onToggleSidebar} title="Open sidebar">
                            <HiOutlineBars3 />
                        </button>
                    )}
                    <span className="topbar-title">AI OmniStruct Chat</span>
                </div>

                <div className="topbar-right">
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
            </div>

            {/* Main Layout Wrapper */}
            <div className="chat-main-content">
                <div className="chat-main-column">
                    {/* Messages Area */}
                    <div className="chat-messages-area">
                        <div className="chat-centered-container">
                            <div className="chat-messages-inner">
                        {isWelcomeScreen ? (
                            <div className="welcome fade-in">
                                <h1 className="welcome-title">OmniStruct AI</h1>
                                <div className="suggestions">
                                    <button className="suggestion-pill" onClick={() => handleSuggestion("Extract all tables as a structured dataset")}>
                                        Extract all tables
                                    </button>
                                    <button className="suggestion-pill" onClick={() => handleSuggestion("Find and list all mentions of financial figures")}>
                                        Analyze finances
                                    </button>
                                    <button className="suggestion-pill" onClick={() => handleSuggestion("Identify and extract stakeholder names")}>
                                        Extract entities
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="messages-list">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`message ${msg.role}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                        <div className="message-inner">
                                            <div className="message-avatar">
                                                {msg.role === 'ai' ? <HiOutlineSparkles /> : <HiOutlineUser />}
                                            </div>
                                            <div className="message-body">
                                                <span className="message-role">{msg.role === 'ai' ? 'OmniStruct AI' : 'You'}</span>

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



                                                {/* Dataset Table Section */}
                                                {msg.dataset && (
                                                    <div className="message-dataset fade-in">
                                                        <div className="dataset-header">
                                                            <div className="dataset-title">
                                                                Extracted Dataset ({msg.dataset.rows.length} rows)
                                                            </div>
                                                            <div className="dataset-actions">
                                                                {msg.dataset.references?.length > 0 && (
                                                                    <button
                                                                        className="dataset-action-btn"
                                                                        onClick={() => setActiveCitations(msg.dataset.references)}
                                                                        title="View Citations"
                                                                    >
                                                                        <HiOutlineLink />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    className="dataset-action-btn"
                                                                    onClick={() => setShowMiniChat(true)}
                                                                    title="Ask AI about this data"
                                                                >
                                                                    <HiOutlineSparkles />
                                                                </button>
                                                                <button
                                                                    className="dataset-action-btn"
                                                                    onClick={() => handleDownload(msg.dataset)}
                                                                    title={`Download ${msg.dataset.format.toUpperCase()}`}
                                                                >
                                                                    <HiOutlineArrowDownTray />
                                                                </button>
                                                            </div>
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
                                                            {msg.dataset.rows.length > 10 && (
                                                                <p className="dataset-more">
                                                                    Showing 10 of {msg.dataset.rows.length} rows. Download for full data.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Loading indicator */}
                                {loading && (
                                    <div className="message ai fade-in">
                                        <div className="message-inner">
                                            <div className="message-avatar">
                                                <HiOutlineSparkles />
                                            </div>
                                            <div className="message-body">
                                                <span className="message-role">OmniStruct AI</span>
                                                <div className="typing-dots">
                                                    <span></span><span></span><span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Input Bar */}
            <div className="chat-input-area-wrapper">
                    <div className="chat-input-area">
                        <div className="input-container">
                            {/* File attachment chips */}
                            {files.length > 0 && (
                                <div className="input-file-list">
                                    {files.map((f, i) => (
                                        <div key={i} className="file-chip">
                                            <HiOutlineDocumentText />
                                            <span className="file-chip-name">{f.name}</span>
                                            <span className="file-chip-size">{formatFileSize(f.size)}</span>
                                            <button 
                                                className="file-chip-remove" 
                                                onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                                            >
                                                <HiOutlineXMark />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="input-row">
                                <div className="input-actions-left">
                                    <button
                                        className="input-action-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Attach Documents"
                                        disabled={loading}
                                    >
                                        <HiOutlinePlusCircle />
                                    </button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.xlsx,.xls,.csv,.docx,.png,.jpg,.jpeg"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />

                                <textarea
                                    ref={textareaRef}
                                    className="chat-textarea"
                                    placeholder="Upload a document or ask about your data..."
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
                            OmniStruct AI uses multi-agent extraction for smart dataset synthesis.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Floating Chat Bubble & Panel */}
        {datasetReady && (
            <div className={`floating-chat-container ${showMiniChat ? 'expanded' : ''}`}>
                {!showMiniChat ? (
                    <button 
                        className="floating-chat-bubble" 
                        onClick={() => setShowMiniChat(true)}
                        title="Open Dataset Chat"
                    >
                        <HiOutlineSparkles />
                        <div className="bubble-ping"></div>
                    </button>
                ) : (
                    <div 
                        className="floating-chat-panel slide-up"
                        style={{ 
                            position: isDragging || miniPosition.x !== 0 ? 'fixed' : 'absolute',
                            left: miniPosition.x !== 0 ? miniPosition.x : 'auto',
                            top: miniPosition.y !== 0 ? miniPosition.y : 'auto',
                            bottom: miniPosition.x === 0 ? '20px' : 'auto',
                            right: miniPosition.x === 0 ? '0' : 'auto',
                            cursor: isDragging ? 'grabbing' : 'auto'
                        }}
                    >
                        <div className="mini-chat-header" onMouseDown={handleMouseDown}>
                            <div className="header-info">
                                <HiOutlineSparkles />
                                <span>Dataset Analyst</span>
                            </div>
                            <button className="mini-close" onClick={() => { setShowMiniChat(false); setMiniPosition({x:0, y:0}); }}>
                                <HiOutlineXMark />
                            </button>
                        </div>
                        <div className="mini-chat-body">
                            <div className="mini-messages-list">
                                {miniMessages.length === 0 && (
                                    <p className="mini-hint">Ask anything about the extracted tables or findings.</p>
                                )}
                                {miniMessages.map((m, i) => (
                                    <div key={i} className={`mini-message ${m.role}`}>
                                        <div className="mini-message-content">{m.content}</div>
                                    </div>
                                ))}
                                {miniLoading && (
                                    <div className="mini-message ai loading">
                                        <div className="typing-dots"><span></span><span></span><span></span></div>
                                    </div>
                                )}
                            </div>
                            <div className="mini-input-wrap">
                                <textarea
                                    className="mini-textarea"
                                    placeholder="Ask a question..."
                                    value={miniInput}
                                    onChange={(e) => setMiniInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleMiniSend();
                                        }
                                    }}
                                    autoFocus
                                />
                                <button
                                    className="mini-send"
                                    onClick={handleMiniSend}
                                    disabled={!miniInput.trim() || miniLoading}
                                >
                                    <HiOutlineArrowUp />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

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
