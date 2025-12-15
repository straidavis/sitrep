import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
    WifiOff
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useDeployment } from '../context/DeploymentContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [serverConnected, setServerConnected] = useState(true); // Default false? Or optimistic?

    // Check Server Connection
    // Check Server Connection
    useEffect(() => {
        const checkStatus = async () => {
            if (!window.navigator.onLine) {
                setServerConnected(false);
                return;
            }
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
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
    const { user, login, logout, isAuthenticated, roles } = useAuth();

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
        { path: '/flights', icon: Plane, label: 'Flights (AMCR)' },
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
                        <img src="/logo.png" alt="USCG Logo" style={{ width: '40px', height: '40px' }} />
                        <div className="brand-text">
                            <h1>AMCR</h1>
                            <p className={selectedDeploymentIds.length > 0 ? "text-accent-primary font-bold" : ""}>
                                {deploymentTitle}
                            </p>
                        </div>
                    </div>

                    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                        {/* Global Deployment Selector */}
                        <div className="relative" style={{ minWidth: '280px' }} ref={dropdownRef}>
                            <button
                                className="select"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    textAlign: 'left'
                                }}
                            >
                                <span style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '240px'
                                }}>
                                    {getDisplayText()}
                                </span>
                                <ChevronDown size={16} />
                            </button>

                            {dropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    marginTop: '4px',
                                    zIndex: 100,
                                    boxShadow: 'var(--shadow-lg)',
                                    maxHeight: '400px',
                                    overflowY: 'auto'
                                }}>
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
                                    <div style={{ padding: '8px 0' }}>
                                        {deployments.map(deployment => {
                                            const isSelected = selectedDeploymentIds.includes(deployment.id);
                                            const isInactive = ['Completed', 'Cancelled'].includes(deployment.status);

                                            return (
                                                <div
                                                    key={deployment.id}
                                                    onClick={() => toggleDeployment(deployment.id)}
                                                    style={{
                                                        padding: '8px 16px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        opacity: isInactive ? 0.5 : 1,
                                                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                    className="hover:bg-tertiary"
                                                >
                                                    <div style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        border: '1px solid var(--color-border)',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                                                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)'
                                                    }}>
                                                        {isSelected && <Check size={12} color="white" />}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{deployment.name}</div>
                                                        <div style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>
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
                            <button className="btn btn-primary" onClick={() => login()}>
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
                                >
                                    <Icon size={20} />
                                    <span className="nav-label">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Server Status Footer */}
                    <div className={`border-t border-border bg-transparent transition-all duration-300 ${sidebarOpen ? 'p-4 opacity-100' : 'p-0 opacity-0 overflow-hidden h-0 border-none'}`}>
                        <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity duration-300">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${serverConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse'}`}></div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] leading-none ${serverConnected ? 'text-muted' : 'text-warning'}`}>
                                    {serverConnected ? 'System Online' : 'Local Mode'}
                                </span>
                                {!serverConnected && (
                                    <span className="text-[9px] text-muted mt-1 font-medium">
                                        Updates sync when online
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="app-main">
                    <div className="main-content">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
