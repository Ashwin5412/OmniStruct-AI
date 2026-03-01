import React from 'react';
import UploadTest from './UploadTest';

function App() {
  return (
    <div className="App" style={styles.appContainer}>
      <header style={styles.header}>
        <h1 style={styles.title}>Data Extraction & xAI Engine</h1>
        <p style={styles.subtitle}>Multi-agent RAG system with source anchoring</p>
      </header>
      
      <main>
        <UploadTest />
      </main>
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#f4f7f6',
    padding: '40px 20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px'
  },
  title: {
    color: '#333',
    margin: '0 0 10px 0',
    fontSize: '2.5rem'
  },
  subtitle: {
    color: '#666',
    margin: '0',
    fontSize: '1.1rem'
  }
};

export default App;