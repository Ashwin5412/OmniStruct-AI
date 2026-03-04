import React, { useState, useRef, useEffect } from 'react';

const ChatView = ({ setCurrentView }) => {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([
        { role: 'ai', text: 'Hello! I have analyzed your extracted dataset. What specific insights or trends are you looking for?' }
    ]);
    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // FUTURE BACKEND TIE-IN: Chat Agent
    const handleSend = (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        const newMessages = [...messages, { role: 'user', text: prompt }];
        setMessages(newMessages);
        setPrompt('');

        // Mock AI response
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                role: 'ai', 
                text: "Based on the dataset, I can see a correlation. (Backend connection pending...)" 
            }]);
        }, 800);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-950">
            {/* Header */}
            <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-gray-900/90 backdrop-blur-md shrink-0 z-10 shadow-sm">
                <button 
                    onClick={() => setCurrentView('extract')}
                    className="text-gray-400 hover:text-emerald-400 flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <span className="text-lg">←</span> Back to Extraction
                </button>
                <div className="mx-auto font-semibold text-gray-200 tracking-wide">Data Analytics Agent</div>
                <div className="w-32"></div> {/* Spacer for perfect centering */}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-6 py-4 text-[15px] leading-relaxed shadow-md ${
                                msg.role === 'user' 
                                ? 'bg-emerald-600 text-white rounded-br-sm' 
                                : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent pt-12 shrink-0">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto relative group">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask questions about your generated data..." 
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all shadow-xl text-lg"
                    />
                    <button 
                        type="submit" 
                        className="absolute right-2.5 top-2.5 bottom-2.5 aspect-square bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center text-white transition-all shadow-md active:scale-95"
                    >
                        <span className="text-xl">⇧</span>
                    </button>
                </form>
                <div className="text-center mt-3 text-xs text-gray-500 font-medium">
                    OmniStruct-AI can make mistakes. Verify important data.
                </div>
            </div>
        </div>
    );
};

export default ChatView;