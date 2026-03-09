import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { getSessions, getSession } from './services/api';
import './App.css';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const sessions = await getSessions();
        const mapped = sessions.map(s => ({
          id: s.id,
          title: s.filename,
          sessionId: s.id
        }));
        setConversations(mapped);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      }
    }
    loadSessions();
  }, []);

  const handleNewChat = () => {
    setActiveConv(null);
  };

  const handleSelectConv = async (conv) => {
    try {
      const details = await getSession(conv.id);
      setActiveConv({ ...details, id: conv.id });
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
  };

  const handleConversationCreated = (conv) => {
    setConversations((prev) => [conv, ...prev]);
    setActiveConv(conv);
  };

  const handleDeleteSession = (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConv?.id === id) {
      setActiveConv(null);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        conversations={conversations}
        activeId={activeConv?.id}
        onNewChat={handleNewChat}
        onSelect={handleSelectConv}
        onDelete={handleDeleteSession}
      />
      <ChatArea
        key={activeConv?.sessionId || activeConv?.id || 'new'}
        conversation={activeConv}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
