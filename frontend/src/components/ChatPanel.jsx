import { useState, useRef, useEffect } from 'react';
import { HiOutlinePaperAirplane, HiOutlineSparkles, HiOutlineUser } from 'react-icons/hi2';
import './ChatPanel.css';

export default function ChatPanel({ onSend, isLoading }) {
    const [messages, setMessages] = useState([
        {
            role: 'ai',
            text: 'Hello! I\'ve analyzed your extracted dataset. Feel free to ask me anything about the data — column details, statistics, patterns, or any specific questions you have.',
        },
    ]);
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        const userMsg = { role: 'user', text: question };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');

        try {
            const response = await onSend(question);
            setMessages((prev) => [
                ...prev,
                { role: 'ai', text: response?.answer || response || 'I couldn\'t process that question. Please try again.' },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: 'ai', text: 'Something went wrong. Please try asking again.' },
            ]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="chat-panel glass-card">
            <div className="chat-header">
                <HiOutlineSparkles className="chat-header-icon" />
                <span>Ask about your dataset</span>
            </div>

            <div className="chat-messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role}`}>
                        <div className="bubble-avatar">
                            {msg.role === 'ai' ? <HiOutlineSparkles /> : <HiOutlineUser />}
                        </div>
                        <div className="bubble-content">
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-bubble ai">
                        <div className="bubble-avatar">
                            <HiOutlineSparkles />
                        </div>
                        <div className="bubble-content">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="chat-input-bar">
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask a question about the dataset..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    id="chat-input"
                />
                <button
                    className="chat-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    title="Send"
                    id="chat-send"
                >
                    <HiOutlinePaperAirplane />
                </button>
            </div>
        </div>
    );
}
