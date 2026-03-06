import { Link, useLocation } from 'react-router-dom';
import { HiOutlineSparkles } from 'react-icons/hi2';
import './Navbar.css';

export default function Navbar() {
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="navbar-inner container">
                <Link to="/" className="navbar-brand">
                    <div className="navbar-logo">
                        <HiOutlineSparkles />
                    </div>
                    <div className="navbar-titles">
                        <span className="navbar-name gradient-text">DataSynth AI</span>
                        <span className="navbar-tagline">Multi-Agent Dataset Synthesis</span>
                    </div>
                </Link>

                <div className="navbar-nav">
                    <Link
                        to="/"
                        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                    >
                        Extract
                    </Link>
                    <Link
                        to="/preview"
                        className={`nav-link ${location.pathname === '/preview' ? 'active' : ''}`}
                    >
                        Preview
                    </Link>
                </div>
            </div>
        </nav>
    );
}
