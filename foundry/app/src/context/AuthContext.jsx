import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../db/schema';
import bcrypt from 'bcryptjs';
import { config } from '../config';

// MSAL Imports
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider, useMsal, useIsAuthenticated } from "@azure/msal-react";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// --- MSAL Configuration ---
// Create instance only if mode is microsoft to avoid errors with empty config
let msalInstance = null;

if (config.authMode === 'microsoft' && config.m365?.clientId) {
    msalInstance = new PublicClientApplication({
        auth: {
            clientId: config.m365.clientId,
            authority: `https://login.microsoftonline.com/${config.m365.tenantId}`,
            redirectUri: config.m365.redirectUri
        },
        cache: {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false,
        }
    });

    // Initialize
    if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
        msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
    }

    msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
            const account = event.payload.account;
            msalInstance.setActiveAccount(account);
        }
    });
}

// --- M365 Provider Component ---
const M365AuthProviderInner = ({ children }) => {
    const { instance, accounts, inProgress } = useMsal();
    const isMsalAuth = useIsAuthenticated();
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [accessStatus, setAccessStatus] = useState('Checking');
    const [loading, setLoading] = useState(true);

    const account = instance.getActiveAccount();

    useEffect(() => {
        if (inProgress === "none") {
            setLoading(false);
        }
    }, [inProgress]);

    useEffect(() => {
        if (account) {
            const email = account.username || account.idTokenClaims?.email || "";
            // Logic: Default Admin Check
            const isDefaultAdmin = email.toLowerCase() === (config.defaultAdmin || "").toLowerCase();

            setUser({
                id: account.localAccountId, // or homeAccountId
                name: account.name,
                username: email
            });

            // Role Logic
            // In a real app, you might sync M365 user to local DB to fetch stored roles.
            // Here we use the Default Admin config + maybe DB?
            // For now: Plain M365 + Config Admin.
            if (isDefaultAdmin) {
                setRoles(['Sitrep.Admin', 'Sitrep.Editor']);
            } else {
                setRoles(['Sitrep.Editor']); // Default generic access? Or 'Viewer'?
                // If we want detailed roles, we'd query DB here:
                // db.users.where('email').equals(email).first().then(...)
            }

            setAccessStatus('Granted');
        } else {
            setUser(null);
            setRoles([]);
            setAccessStatus('None');
        }
    }, [account]);

    const login = async () => {
        try {
            await instance.loginPopup({
                scopes: ["User.Read", "Directory.Read.All"]
            });
        } catch (e) {
            console.error(e);
        }
    };

    const logout = () => {
        instance.logoutPopup();
    };

    // M365 users don't change passwords here
    const changePassword = async () => {
        alert("Please change your password via Microsoft 365 portal.");
    };

    const canEdit = useMemo(() => {
        if (!account) return false;
        return roles.includes('Sitrep.Editor') || roles.includes('Sitrep.Admin');
    }, [roles, account]);

    const value = {
        isAuthenticated: !!account,
        user,
        roles,
        accessStatus,
        canEdit,
        login,
        logout,
        changePassword,
        loading: loading || inProgress !== 'none' // Wait for MSAL init
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// --- Local Provider Component (Existing Logic) ---
const LocalAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [roles, setRoles] = useState([]);
    const [accessStatus, setAccessStatus] = useState('Checking');
    const [loading, setLoading] = useState(true);

    // Initial Session Check
    useEffect(() => {
        const checkSession = async () => {
            const storedUserId = localStorage.getItem('sitrep_userId');
            if (storedUserId) {
                try {
                    const dbUser = await db.users.get(parseInt(storedUserId));
                    if (dbUser) {
                        setUser({
                            id: dbUser.id,
                            name: dbUser.email.split('@')[0],
                            username: dbUser.email,
                            mustChangePassword: dbUser.mustChangePassword
                        });
                        setRoles(dbUser.role ? [dbUser.role] : []);
                        if (dbUser.role === 'Sitrep.Admin') setRoles(['Sitrep.Admin', 'Sitrep.Editor']);
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
            const dbUser = await db.users.where('email').equals(email).first();
            if (!dbUser) {
                // Fallback / Bootstrap Admin: Allow admin/admin if no user found with email "admin"
                if (email === 'admin' && password === 'admin') {
                    // Check if a real user named "admin" exists? No, we just checked !dbUser.
                    // So if you type "admin" and it's not in the DB, we let you in as Bootstrap.
                    // This allows recovery even if other users exist.
                    // Bootstrap
                    setUser({ id: 0, name: 'Bootstrap Admin', username: 'admin', mustChangePassword: false });
                    setRoles(['Sitrep.Admin', 'Sitrep.Editor']);
                    setIsAuthenticated(true);
                    setAccessStatus('Granted');
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
            if (dbUser.role === 'Sitrep.Admin') userRoles.push('Sitrep.Editor');
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
        await db.users.update(user.id, {
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
    // If config says microsoft, wrap in MsalProvider -> M365AuthProviderInner
    // Else LocalAuthProvider

    if (config.authMode === 'microsoft') {
        if (!msalInstance) {
            return <div className="p-8 text-error">MSAL Configuration Missing. Check sitrep-config.json.</div>;
        }
        return (
            <MsalProvider instance={msalInstance}>
                <M365AuthProviderInner>{children}</M365AuthProviderInner>
            </MsalProvider>
        );
    }

    return <LocalAuthProvider>{children}</LocalAuthProvider>;
};
