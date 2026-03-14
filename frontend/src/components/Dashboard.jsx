import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ExtractView from './ExtractView';
import ChatView from './ChatView';

const Dashboard = () => {
    // Shared Global State (Ready for FastAPI integration)
    const [currentView, setCurrentView] = useState('extract'); 
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [dataset, setDataset] = useState(null);
    const [format, setFormat] = useState('csv');

    return (
        <div className="flex w-full h-screen bg-gray-950 overflow-hidden font-sans text-gray-200 selection:bg-emerald-500 selection:text-white">
            <Sidebar />
            
            <main className="flex-1 h-full relative overflow-hidden">
                {currentView === 'extract' ? (
                    <ExtractView 
                        selectedFiles={selectedFiles} 
                        setSelectedFiles={setSelectedFiles}
                        dataset={dataset}
                        setDataset={setDataset}
                        format={format}
                        setFormat={setFormat}
                        setCurrentView={setCurrentView}
                    />
                ) : (
                    <ChatView setCurrentView={setCurrentView} />
                )}
            </main>
        </div>
    );
};

export default Dashboard;