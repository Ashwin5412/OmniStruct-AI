import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSparkles,
    HiOutlineRocketLaunch,
    HiOutlineCpuChip,
    HiOutlineShieldCheck,
    HiOutlineLightBulb,
} from 'react-icons/hi2';
import FileUpload from '../components/FileUpload';
import FormatSelector from '../components/FormatSelector';
import LoadingOverlay from '../components/LoadingOverlay';
import { uploadAndExtract } from '../services/api';
import './UploadPage.css';

const FEATURES = [
    { icon: <HiOutlineCpuChip />, title: 'Multi-Agent AI', desc: 'Orchestrated agents extract structured data from complex PDFs' },
    { icon: <HiOutlineShieldCheck />, title: 'Verifiable Output', desc: 'Every extracted field is traceable back to its source' },
    { icon: <HiOutlineLightBulb />, title: 'Explainable AI', desc: 'Transparent linkage between source data and generated datasets' },
];

export default function UploadPage() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [format, setFormat] = useState('json');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const maxChars = 1000;
    const canSubmit = file && prompt.trim().length > 0;

    const handleExtract = async () => {
        if (!canSubmit) return;
        setError('');
        setLoading(true);

        try {
            const result = await uploadAndExtract(file, prompt, format);
            navigate('/preview', {
                state: {
                    sessionId: result.sessionId,
                    columns: result.columns,
                    rows: result.rows,
                    summary: result.summary,
                    format,
                },
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to process the document. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="upload-page">
            {loading && <LoadingOverlay message="Analyzing your PDF and synthesizing dataset..." />}

            {/* Hero */}
            <section className="hero fade-in-up">
                <div className="hero-badge">
                    <HiOutlineSparkles />
                    <span>Powered by Multi-Agent AI</span>
                </div>
                <h1 className="hero-title">
                    <span className="gradient-text">Dataset Synthesis</span>
                    <br />
                    from Any PDF Document
                </h1>
                <p className="hero-subtitle">
                    Upload a PDF, describe the data you need, and let our AI agents extract
                    a structured, verifiable dataset with explainable linkage.
                </p>
            </section>

            {/* Main Form */}
            <section className="upload-form container fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="form-grid">
                    {/* Left: Upload + Prompt */}
                    <div className="form-left">
                        <div className="form-section">
                            <h3 className="section-title">
                                <span className="section-number">1</span>
                                Upload Document
                            </h3>
                            <FileUpload
                                file={file}
                                onFileSelect={setFile}
                                onFileClear={() => setFile(null)}
                            />
                        </div>

                        <div className="form-section">
                            <h3 className="section-title">
                                <span className="section-number">2</span>
                                Describe Your Dataset
                            </h3>
                            <div className="prompt-wrapper glass-card">
                                <textarea
                                    className="prompt-input"
                                    placeholder="e.g. Extract all research findings with author names, publication dates, methodologies, and key results..."
                                    value={prompt}
                                    onChange={(e) => {
                                        if (e.target.value.length <= maxChars) setPrompt(e.target.value);
                                    }}
                                    rows={5}
                                    id="prompt-input"
                                />
                                <div className="prompt-footer">
                                    <span className="char-count">
                                        {prompt.length}/{maxChars}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Format + Submit */}
                    <div className="form-right">
                        <div className="form-section">
                            <h3 className="section-title">
                                <span className="section-number">3</span>
                                Choose Format
                            </h3>
                            <FormatSelector selected={format} onSelect={setFormat} />
                        </div>

                        {error && (
                            <div className="error-banner">
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            className="btn-primary extract-btn"
                            disabled={!canSubmit || loading}
                            onClick={handleExtract}
                            id="extract-btn"
                        >
                            <HiOutlineRocketLaunch />
                            Extract Dataset
                        </button>

                        {/* Features */}
                        <div className="features-mini">
                            {FEATURES.map((f, i) => (
                                <div key={i} className="feature-mini glass-card">
                                    <div className="feature-mini-icon">{f.icon}</div>
                                    <div>
                                        <strong>{f.title}</strong>
                                        <p>{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
