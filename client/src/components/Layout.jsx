import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import {
    Home,
    Plane,
    Package,
    MapPin,
    FileText,
    Settings,
    Menu,
    X,
    ChevronDown,
    Check,
    LogOut,
    Shield,
    Briefcase,
    ClipboardList,
    Truck,
    Wifi,
    WifiOff,
    LogIn,
    Lock,
    Clock
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';

import { config } from '../config';

import LoginForm from './LoginForm';
import Modal from './Modal';

const Layout = ({ children }) => {
    const location = useLocation();
    // Default to closed on mobile (< 768px), open on desktop
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [serverConnected, setServerConnected] = useState(true); // Default false? Or optimistic?

    // Check Server Connection
    useEffect(() => {
        const checkStatus = async () => {
            if (!window.navigator.onLine) {
                setServerConnected(false);
                return;
            }
            try {
                const apiUrl = config.serverUrl;
                const controller = new AbortController();
                // Increased timeout to 5s
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch(`${apiUrl}/health?t=${Date.now()}`, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                clearTimeout(timeoutId);

                if (res.ok) setServerConnected(true);
                else setServerConnected(false);
            } catch (e) {
                console.warn("Connection check failed:", e);
                setServerConnected(false);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 15000); // 15s check

        const handleNetworkChange = () => checkStatus();
        window.addEventListener('online', handleNetworkChange);
        window.addEventListener('offline', handleNetworkChange);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleNetworkChange);
            window.removeEventListener('offline', handleNetworkChange);
        };
    }, []);

    const { selectedDeploymentIds, setSelectedDeploymentIds, deployments, deployerWarning } = useDeployment();
    const { user, login, logout, isAuthenticated, roles, accessStatus, requestAccess } = useAuth();

    // Determine Header Title based on Selection
    const deploymentTitle = (() => {
        if (selectedDeploymentIds.length === 1) {
            const dep = deployments.find(d => d.id === selectedDeploymentIds[0]);
            return dep ? dep.name : 'Unknown Deployment';
        }
        if (selectedDeploymentIds.length > 1) return 'Multiple Deployments Selected';
        return 'Global View'; // or Aircraft Materiel Condition Report
    })();

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/flights', icon: Plane, label: 'Flights' },
        { path: '/equipment', icon: Package, label: 'Equipment' },
        { path: '/inventory', icon: ClipboardList, label: 'Master Inventory' },
        { path: '/kits', icon: Briefcase, label: 'Inventory Kits' },
        { path: '/parts', icon: Truck, label: 'Track Parts' },
        { path: '/deployments', icon: MapPin, label: 'Deployments' },
        { path: '/reports', icon: FileText, label: 'Reports' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    if (roles && roles.includes('Sitrep.Admin')) {
        navItems.push({ path: '/admin', icon: Shield, label: 'Admin Portal' });
    }

    const selectedDeployment = (selectedDeploymentIds.length === 1)
        ? deployments.find(d => d.id === selectedDeploymentIds[0])
        : null;

    const inventoryNeedsUpdate = React.useMemo(() => {
        if (!selectedDeployment) return false;
        if (!selectedDeployment.lastInventoryUpdate) return true; // Never updated
        return differenceInDays(new Date(), new Date(selectedDeployment.lastInventoryUpdate)) > 7;
    }, [selectedDeployment]);

    const isActive = (path) => location.pathname === path;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleDeployment = (id) => {
        if (selectedDeploymentIds.includes(id)) {
            setSelectedDeploymentIds(selectedDeploymentIds.filter(dId => dId !== id));
        } else {
            setSelectedDeploymentIds([...selectedDeploymentIds, id]);
        }
    };

    const selectAll = () => setSelectedDeploymentIds(deployments.map(d => d.id));
    const selectAllActive = () => setSelectedDeploymentIds(deployments.filter(d => d.status === 'Active').map(d => d.id));
    const clearSelection = () => setSelectedDeploymentIds([]);

    const getDisplayText = () => {
        if (deployments.length === 0) return 'No Deployments';
        if (selectedDeploymentIds.length === 0) return 'Select Deployment...';
        if (selectedDeploymentIds.length === deployments.length) return 'All Deployments';
        if (selectedDeploymentIds.length === 1) {
            const dep = deployments.find(d => d.id === selectedDeploymentIds[0]);
            return dep ? dep.name : 'Unknown';
        }
        return `${selectedDeploymentIds.length} Deployments Selected`;
    };

    return (
        <div className="app-layout">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <button
                        className="menu-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        aria-label="Toggle menu"
                    >
                        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <div className="header-brand">
                        <img src="logo.png" alt="App Logo" style={{ width: '40px', height: '40px' }} />
                        <div className="brand-text">
                            <h1>S.P.A.R.K.</h1>
                            <p className="text-muted text-xs font-medium uppercase tracking-wider mb-0">Status, Parts, Aircraft Readiness & Kits</p>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block" style={{ height: '32px', width: '1px', backgroundColor: 'var(--color-border)', margin: '0 1.5rem' }}></div>

                        {/* Context Title */}
                        <div className={`font-bold text-lg hidden md:block ${selectedDeploymentIds.length > 0 ? "text-accent-primary" : "text-muted"}`}>
                            {deploymentTitle}
                        </div>
                    </div>

                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                        {/* Global Deployment Selector */}
                        <div className="relative deployment-selector-container" ref={dropdownRef}>
                            <button
                                className="select deployment-trigger"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                            >
                                <span className="deployment-label">
                                    {getDisplayText()}
                                </span>
                                <ChevronDown size={16} />
                            </button>

                            {dropdownOpen && (
                                <div className="deployment-dropdown">
                                    <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
                                        <button
                                            className="btn btn-sm btn-ghost w-full text-left mb-1"
                                            onClick={selectAllActive}
                                        >
                                            All Active Deployments
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost w-full text-left"
                                            onClick={selectAll}
                                        >
                                            Select All
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost w-full text-left text-muted"
                                            onClick={clearSelection}
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                    <div style={{ padding: '8px 0', maxHeight: '40vh', overflowY: 'auto' }}>
                                        {deployments.map(deployment => {
                                            const isSelected = selectedDeploymentIds.includes(deployment.id);
                                            const isInactive = ['Completed', 'Cancelled'].includes(deployment.status);

                                            return (
                                                <div
                                                    key={deployment.id}
                                                    onClick={() => toggleDeployment(deployment.id)}
                                                    className={`deployment-item ${isSelected ? 'selected' : ''} ${isInactive ? 'inactive' : ''}`}
                                                >
                                                    <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                                                        {isSelected && <Check size={12} color="white" />}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="truncate font-medium">{deployment.name}</div>
                                                        <div className="text-xs text-muted truncate">
                                                            {deployment.location} • {deployment.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {deployments.length === 0 && (
                                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                No deployments found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Server Status Indicator */}
                        <div className="flex items-center" title={serverConnected ? "System Online" : "Local Mode (Offline)"}>
                            {serverConnected ? (
                                <Wifi size={20} className="text-emerald-500" />
                            ) : (
                                <WifiOff size={20} className="text-amber-500 animate-pulse" />
                            )}
                        </div>

                        {/* User Profile / Auth */}
                        {isAuthenticated ? (
                            <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <span className="user-name" style={{ display: 'block', fontWeight: 600 }}>{user?.name || 'User'}</span>
                                    <span className="user-role" style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block' }}>{user?.username}</span>
                                </div>
                                <button className="btn btn-sm btn-ghost" onClick={() => logout()} title="Logout">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsLoginModalOpen(true);
                                }}
                            >
                                <LogIn size={18} style={{ marginRight: '8px' }} />
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {deployerWarning && (
                <div className="bg-warning/20 border-b border-warning/30 px-6 py-2 flex items-center justify-center gap-2 text-warning animate-in slide-in-from-top-2">
                    <Check className="h-4 w-4" /> {/* Should be AlertTriangle but reusing existing imports if possible, or new import */}
                    <span className="text-sm font-bold">
                        Warning: You have multiple active deployments. Please ensure you are viewing the correct deployment context.
                    </span>
                </div>
            )}

            <div className="app-body">
                {/* Sidebar */}
                <aside className={`app-sidebar ${sidebarOpen ? 'open' : 'closed'}`} style={{ display: 'flex', flexDirection: 'column' }}>
                    <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={() => {
                                        if (window.innerWidth < 768) setSidebarOpen(false);
                                    }}
                                >
                                    <Icon size={20} />
                                    <span className="nav-label flex-1">{item.label}</span>
                                    {item.path === '/inventory' && inventoryNeedsUpdate && (
                                        <span className="w-2 h-2 rounded-full bg-error animate-pulse ml-2" title="Inventory Update Required"></span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>


                </aside>

                {/* Mobile Sidebar Backdrop */}
                {sidebarOpen && (
                    <div
                        className="sidebar-backdrop"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content */}
                <main className="app-main">
                    <div className="main-content">
                        {children}
                    </div>
                </main>
            </div>

            {/* Login Modal - Portaled and using generic Modal component */}
            {createPortal(
                <Modal
                    isOpen={!isAuthenticated && isLoginModalOpen}
                    onClose={() => setIsLoginModalOpen(false)}
                    title="Sign In"
                    size="md"
                >
                    <LoginForm onLogin={async (email, password) => {
                        const result = await login(email, password);
                        if (result && result.success) {
                            setIsLoginModalOpen(false);
                        }
                        return result;
                    }} />
                    <div className="mt-6 text-xs text-muted uppercase tracking-widest text-center">
                        Internal Use Only
                    </div>
                </Modal>,
                document.body
            )}

            {/* Change Password Overlay */}
            {isAuthenticated && user?.mustChangePassword && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-bg-primary/95 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-bg-secondary p-8 rounded-xl shadow-2xl border border-border w-full max-w-md animate-in zoom-in-95 duration-300 mx-4">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-6 text-warning">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Change Password</h2>
                            <p className="text-muted mb-6">
                                You must change your temporary password before continuing.
                            </p>
                            <ChangePasswordForm />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ChangePasswordForm = () => {
    const { changePassword, logout } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    // Simple complexity check logic
    const validatePassword = (pwd) => {
        if (pwd.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Z]/.test(pwd)) return "Password must contain an uppercase letter.";
        if (!/[0-9]/.test(pwd)) return "Password must contain a number.";
        if (!/[!@#$%^&*]/.test(pwd)) return "Password must contain a special character (!@#$%^&*).";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const complexityError = validatePassword(password);
        if (complexityError) {
            setError(complexityError);
            return;
        }

        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }

        try {
            await changePassword(password);
            // On success, the overlay disappears because user.mustChangePassword becomes false
        } catch (e) {
            setError("Failed to update password.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full text-left flex flex-col gap-4">
            {error && <div className="text-error text-sm text-center bg-error/10 p-2 rounded">{error}</div>}

            <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                    type="password"
                    className="input w-full"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <span className="text-xs text-muted mt-1 block">Min 8 chars, 1 uppercase, 1 number, 1 special char.</span>
            </div>

            <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                    type="password"
                    className="input w-full"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                />
            </div>

            <div className="flex gap-3 mt-2">
                <button
                    type="button"
                    onClick={logout}
                    className="btn btn-secondary flex-1"
                >
                    Cancel (Log Out)
                </button>
                <button
                    type="submit"
                    className="btn btn-primary flex-1"
                >
                    Update Password
                </button>
            </div>
        </form>
    );
};

export default Layout;
