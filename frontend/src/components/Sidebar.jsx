import {
    HiOutlinePlus,
    HiOutlineChatBubbleLeft,
    HiOutlineChevronLeft,
    HiOutlineTrash,
    HiOutlineSparkles,
    HiOutlineSquare2Stack,
    HiOutlineDocumentDuplicate,
    HiOutlineQueueList,
    HiOutlineAdjustmentsHorizontal,
    HiOutlineArrowRightOnRectangle
} from 'react-icons/hi2';
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
                <div className="sidebar-branding">
                    <div className="brand-logo">
                        <HiOutlineSparkles className="brand-icon" />
                    </div>
                    <span>OmniStruct AI</span>
                </div>
                <button className="sidebar-toggle" onClick={onToggle} title="Toggle sidebar">
                    <HiOutlineChevronLeft />
                </button>
            </div>

            <button className="new-chat-btn" onClick={onNewChat}>
                <HiOutlinePlus />
                <span>New chat</span>
            </button>

            <div className="sidebar-scroll">
                <div className="sidebar-conversations">
                    <div className="section-label">Recent Extractions</div>
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
                                        <span className="conv-title">{conv.title || 'Untitled Chat'}</span>
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


            </div>

            <div className="sidebar-footer">
                {/* Logout removed since sign in is not implemented */}
            </div>
        </aside>
    );
}
