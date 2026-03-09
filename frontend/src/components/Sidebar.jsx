import { HiOutlinePlus, HiOutlineChatBubbleLeft, HiOutlineChevronLeft, HiOutlineTrash } from 'react-icons/hi2';
import { deleteSession } from '../services/api';
import './Sidebar.css';

export default function Sidebar({ open, onToggle, conversations, activeId, onNewChat, onSelect, onDelete }) {
    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this session?')) {
            try {
                await deleteSession(id);
                onDelete(id);
            } catch (err) {
                console.error("Failed to delete session:", err);
            }
        }
    };

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
                            <li key={conv.id} className="conv-item-wrapper">
                                <button
                                    className={`conv-item ${activeId === conv.id ? 'active' : ''}`}
                                    onClick={() => onSelect(conv)}
                                >
                                    <HiOutlineChatBubbleLeft className="conv-icon" />
                                    <span className="conv-title">{conv.title || 'Dataset Extraction'}</span>
                                    <HiOutlineTrash
                                        className="conv-delete-icon"
                                        onClick={(e) => handleDelete(e, conv.id)}
                                        title="Delete chat"
                                    />
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
