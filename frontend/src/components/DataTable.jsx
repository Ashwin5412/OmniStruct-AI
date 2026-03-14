import './DataTable.css';

export default function DataTable({ columns, rows }) {
    if (!columns || columns.length === 0) {
        return (
            <div className="table-empty glass-card">
                <p>No data available to display.</p>
            </div>
        );
    }

    return (
        <div className="table-wrapper glass-card">
            <div className="table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="row-number">#</th>
                            {columns.map((col, i) => (
                                <th key={i}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri}>
                                <td className="row-number">{ri + 1}</td>
                                {columns.map((col, ci) => (
                                    <td key={ci}>{row[col] ?? row[ci] ?? '—'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="table-footer">
                <span className="table-count">
                    {rows.length} row{rows.length !== 1 ? 's' : ''} · {columns.length} column{columns.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    );
}
