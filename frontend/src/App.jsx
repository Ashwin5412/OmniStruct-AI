import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import './App.css';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);

  const handleNewChat = () => {
    setActiveConv(null);
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
  };

  const handleConversationCreated = (conv) => {
    setConversations((prev) => [conv, ...prev]);
    setActiveConv(conv);
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
      />
      <ChatArea
        key={activeConv?.id || 'new'}
        conversation={activeConv}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
