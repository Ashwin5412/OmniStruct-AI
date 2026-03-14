import './LoadingOverlay.css';

export default function LoadingOverlay({ message = 'Processing your document...' }) {
    return (
        <div className="loading-overlay">
            <div className="loading-card glass-card">
                <div className="loading-spinner-ring">
                    <div className="spinner-orbit">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                <h3 className="loading-title gradient-text">AI Agents Working</h3>
                <p className="loading-message">{message}</p>
                <div className="loading-steps">
                    <div className="step active">
                        <span className="step-dot"></span>
                        Parsing PDF document
                    </div>
                    <div className="step">
                        <span className="step-dot"></span>
                        Extracting multi-modal data
                    </div>
                    <div className="step">
                        <span className="step-dot"></span>
                        Synthesizing dataset
                    </div>
                    <div className="step">
                        <span className="step-dot"></span>
                        Verifying with XAI linkage
                    </div>
                </div>
            </div>
        </div>
    );
}
