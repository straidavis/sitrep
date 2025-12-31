import React, { useState, useEffect, useMemo } from 'react';
import { getUserByEmail, getUserById, updateUser, addUser } from '../db/users';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { AuthContext } from './useAuth';

// --- Easy Auth (Entra ID via App Service) Provider ---
const EasyAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [accessStatus, setAccessStatus] = useState('Checking');
    const [loading, setLoading] = useState(true);

    const log = (msg, data = null) => {
        console.log(msg, data);
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Azure App Service Easy Auth Endpoint
                log("Attempting Easy Auth check via /.auth/me (Auth Mode: " + config.authMode + ")");

                // --- MANUAL AUTH EMULATION HANDLER ---
                if (window.location.hash.includes('id_token=')) {
                    log("Detected ID Token in hash. Processing...");
                    const params = new URLSearchParams(window.location.hash.substring(1));
                    const idToken = params.get('id_token');
                    if (idToken) {
                        try {
                            log("Decoding ID Token...");
                            // Simple Decode (Payload is part 1)
                            const base64Url = idToken.split('.')[1];
                            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                            }).join(''));
                            const profile = JSON.parse(jsonPayload);
                            log("Decoded User:", profile.name);

                            // Map to Sitrep User
                            const userPayload = {
                                id: profile.email || profile.preferred_username || profile.oid,
                                name: profile.name,
                                username: profile.email || profile.preferred_username,
                                _json: profile
                            };

                            // Sync with Server (Establish Session)
                            log("Sending to Backend Manual Login (Proxy)...");
                            const loginRes = await fetch(`/.auth/manual-login`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user: userPayload })
                            });
                            log("Backend Sync Status:", loginRes.status);

                            if (loginRes.ok) {
                                const body = await loginRes.json();
                                log("Backend Payload:", body);
                            } else {
                                log("Backend Sync Failed");
                            }

                            // Clear Hash
                            window.history.pushState("", document.title, window.location.pathname + window.location.search);
                            log("Hash cleared.");
                        } catch (e) {
                            log("Failed to process ID Token", e.message);
                        }
                    }
                }
                // -------------------------------------

                const response = await fetch('/.auth/me');
                log("Easy Auth Response Status:", response.status);

                if (response.ok) {
                    const payload = await response.json();

                    if (payload && payload.length > 0) {
                        log("User Active:", payload[0].user_id);
                        const account = payload[0];
                        const email = account.user_id;

                        // Determine Roles (Claims)
                        const claims = account.user_claims || [];
                        let userRoles = ['App.User'];
                        const adminEmail = (config.defaultAdmin || "matt.davis@shield.ai").toLowerCase();
                        if (email && email.toLowerCase() === adminEmail) {
                            userRoles.push('App.Admin');
                        }

                        setUser({
                            id: email,
                            name: account.user_id,
                            username: email
                        });
                        setRoles(userRoles);
                        setAccessStatus('Granted');
                        setLoading(false);
                        return;
                    } else {
                        log("No user data in response");
                    }
                }
            } catch (e) {
                log("Easy Auth check failed:", e.message);
            }

            // Fallback for Local Dev
            if (import.meta.env.DEV) {
                // log("Local Dev Mode Active");
            } else {
                setAccessStatus('None');
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (email, password) => {
        if (import.meta.env.DEV && email && email.startsWith('dev:')) {
            // ... (Dev Login Logic)
            return { success: true };
        }

        // Production Logic: Redirect to Easy Auth Login
        log("Redirecting to MS Login...");
        window.location.href = '/.auth/login/aad';
        return { success: true };
    };

    const logout = () => {
        window.location.href = '/.auth/logout';
    };

    const changePassword = async () => {
        alert("Please change your password via Microsoft 365 portal.");
    };

    const canEdit = true;

    const value = {
        isAuthenticated: !!user,
        user,
        roles,
        accessStatus,
        canEdit,
        login,
        logout,
        changePassword,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// --- Local Provider Component (Existing Logic Preserved) ---
const LocalAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [roles, setRoles] = useState([]);
    const [accessStatus, setAccessStatus] = useState('Checking');
    const [loading, setLoading] = useState(true);

    // Initial Session Check & Seeding
    useEffect(() => {
        const checkSession = async () => {
            // SEEDING: Ensure test users exist in DB for easy assignment
            if (config.authMode === 'local') {
                try {
                    const testEditor = await getUserByEmail('testEditor@test.local');
                    if (!testEditor) {
                        console.log("Seeding testEditor...");
                        await addUser({
                            email: 'testEditor@test.local',
                            role: 'App.User',
                            addedBy: 'System Seeder',
                            createdAt: new Date().toISOString(),
                            tempPassword: 'test' // Consistent with hardcoded check
                        });
                    }
                    const testViewer = await getUserByEmail('testViewer@test.local');
                    if (!testViewer) {
                        console.log("Seeding testViewer...");
                        await addUser({
                            email: 'testViewer@test.local',
                            role: '', // No Role
                            addedBy: 'System Seeder',
                            createdAt: new Date().toISOString(),
                            tempPassword: 'test'
                        });
                    }
                } catch (e) {
                    console.warn("Failed to seed test users:", e);
                }
            }

            const storedUserId = localStorage.getItem('sitrep_userId');
            if (storedUserId) {
                // Special Case: Bootstrap Admin
                if (storedUserId === '0') {
                    setUser({ id: 0, name: 'Bootstrap Admin', username: 'admin', mustChangePassword: false });
                    setRoles(['App.Admin']);
                    setIsAuthenticated(true);
                    setAccessStatus('Granted');
                    setLoading(false);
                    return;
                }

                try {
                    const dbUser = await getUserById(storedUserId);
                    if (dbUser) {
                        setUser({
                            id: dbUser.id,
                            name: dbUser.email.split('@')[0],
                            username: dbUser.email,
                            mustChangePassword: dbUser.mustChangePassword
                        });

                        // Legacy Role Mapping Fix
                        let userRoles = dbUser.role ? [dbUser.role] : [];
                        if (userRoles.includes('Sitrep.Admin')) userRoles = ['App.Admin'];
                        if (userRoles.includes('Sitrep.Editor')) userRoles = ['App.User'];

                        // Strict check for "App.*" roles if manually set

                        setRoles(userRoles);
                        setIsAuthenticated(true);
                        setAccessStatus('Granted');
                    } else {
                        localStorage.removeItem('sitrep_userId');
                        setAccessStatus('None');
                    }
                } catch (e) {
                    console.error("Session restoration failed", e);
                }
            } else {
                setAccessStatus('None');
            }
            setLoading(false);
        };
        checkSession();
    }, []);

    const login = async (email, password) => {
        try {
            // 1. Check DB first (Priority for Persistence)
            const dbUser = await getUserByEmail(email);

            // 2. Fallbacks if not in DB
            if (!dbUser) {
                // Bootstrap Admin (Always available)
                if (email === 'admin' && password === 'admin') {
                    setUser({ id: 0, name: 'Bootstrap Admin', username: 'admin', mustChangePassword: false });
                    setRoles(['App.Admin']);
                    setIsAuthenticated(true);
                    setAccessStatus('Granted');
                    localStorage.setItem('sitrep_userId', '0'); // Persist "0"
                    return { success: true };
                }

                if ((email === 'testEditor' || email === 'testViewer') && password === 'test') {
                    const isEditor = email === 'testEditor';
                    const ephemeralId = isEditor ? -1 : -2;
                    setUser({
                        id: ephemeralId,
                        name: isEditor ? 'Test Editor' : 'Test Viewer',
                        username: isEditor ? 'testEditor@test.local' : 'testViewer@test.local',
                        mustChangePassword: false
                    });
                    setRoles(isEditor ? ['App.User'] : []);
                    setIsAuthenticated(true);
                    setAccessStatus('Granted');
                    console.warn("Logged in as ephemeral test user. Refresh will logout until seeding completes.");
                    return { success: true };
                }

                return { success: false, message: 'User not found' };
            }

            if (dbUser.passwordHash) {
                const isValid = await bcrypt.compare(password, dbUser.passwordHash);
                if (!isValid) return { success: false, message: 'Invalid password' };
            } else if (dbUser.tempPassword) {
                if (password !== dbUser.tempPassword) return { success: false, message: 'Invalid temporary password' };
            } else {
                return { success: false, message: 'Account configuration error. Contact admin.' };
            }

            localStorage.setItem('sitrep_userId', dbUser.id);
            setUser({
                id: dbUser.id,
                name: dbUser.email.split('@')[0],
                username: dbUser.email,
                mustChangePassword: dbUser.mustChangePassword
            });

            const userRoles = dbUser.role ? [dbUser.role] : [];
            setRoles(userRoles);

            setIsAuthenticated(true);
            setAccessStatus('Granted');
            return { success: true };

        } catch (error) {
            console.error('Login error', error);
            return { success: false, message: 'Login failed due to system error.' };
        }
    };

    const logout = () => {
        localStorage.removeItem('sitrep_userId');
        setUser(null);
        setIsAuthenticated(false);
        setRoles([]);
        setAccessStatus('None');
    };

    const changePassword = async (newPassword) => {
        if (!user || !user.id) return;
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await updateUser(user.id, {
            passwordHash: hash,
            tempPassword: null,
            mustChangePassword: false
        });
        setUser(prev => ({ ...prev, mustChangePassword: false }));
        return true;
    };

    const value = {
        isAuthenticated, user, roles, accessStatus, canEdit: isAuthenticated && !user?.mustChangePassword,
        login, logout, changePassword, loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// --- Main AuthProvider Wrapper ---
export const AuthProvider = ({ children }) => {
    // If auth mode is 'microsoft' (Entra), use the Easy Auth Provider
    if (config.authMode === 'microsoft') {
        return <EasyAuthProvider>{children}</EasyAuthProvider>;
    }
    // Otherwise, default to Local
    return <LocalAuthProvider>{children}</LocalAuthProvider>;
};
