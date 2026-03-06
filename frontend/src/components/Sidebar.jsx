import { HiOutlinePlus, HiOutlineChatBubbleLeftRight, HiOutlineChevronLeft } from 'react-icons/hi2';
import './Sidebar.css';

export default function Sidebar({ open, onToggle, conversations, activeId, onNewChat, onSelect }) {
    return (
        <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
            <div className="sidebar-header">
                <button className="new-chat-btn" onClick={onNewChat}>
                    <HiOutlinePlus />
                    <span>New chat</span>
                </button>
                <button className="sidebar-toggle" onClick={onToggle} title="Close sidebar">
                    <HiOutlineChevronLeft />
                </button>
            </div>

            <div className="sidebar-conversations">
                {conversations.length === 0 ? (
                    <p className="sidebar-empty">No previous chats</p>
                ) : (
                    <ul className="conv-list">
                        {conversations.map((conv) => (
                            <li key={conv.id}>
                                <button
                                    className={`conv-item ${activeId === conv.id ? 'active' : ''}`}
                                    onClick={() => onSelect(conv)}
                                >
                                    <HiOutlineChatBubbleLeftRight className="conv-icon" />
                                    <span className="conv-title">{conv.title || 'Dataset Extraction'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="sidebar-footer">
                <div className="sidebar-brand">
                    <div className="brand-dot"></div>
                    <span>DataSynth AI</span>
                </div>
            </div>
        </aside>
    );
}
