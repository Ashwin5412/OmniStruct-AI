import React from 'react';

const Sidebar = () => {
    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full shrink-0 p-4 shadow-xl z-10">
            <div className="mb-8 mt-2 px-2">
                <h2 className="text-xl font-bold text-emerald-500 tracking-wide">OmniStruct-AI</h2>
                <p className="text-xs text-gray-500 mt-1">Data Engine</p>
            </div>

            <div className="flex-1 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">History</h3>
                <ul className="space-y-1">
                    <li className="px-3 py-2 text-sm text-gray-300 bg-gray-800 rounded-lg font-medium cursor-pointer transition-colors">
                        Past Data Synthesized
                    </li>
                    <li className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors">
                        Chat History
                    </li>
                    <li className="px-3 py-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors truncate">
                        Invoice Extraction_v2
                    </li>
                </ul>
            </div>
        </aside>
    );
};

export default Sidebar;