import { HiOutlineTableCells, HiOutlineCodeBracket, HiOutlineDocumentChartBar } from 'react-icons/hi2';
import './FormatSelector.css';

const formats = [
    { id: 'json', label: 'JSON', icon: <HiOutlineCodeBracket /> },
    { id: 'csv', label: 'CSV', icon: <HiOutlineTableCells /> },
    { id: 'excel', label: 'Excel', icon: <HiOutlineDocumentChartBar /> },
];

export default function FormatSelector({ selected, onSelect }) {
    return (
        <div className="format-selector">
            <label className="format-label">Output Format</label>
            <div className="format-pills">
                {formats.map((f) => (
                    <button
                        key={f.id}
                        className={`format-pill ${selected === f.id ? 'active' : ''}`}
                        onClick={() => onSelect(f.id)}
                        type="button"
                    >
                        <span className="format-pill-icon">{f.icon}</span>
                        {f.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
