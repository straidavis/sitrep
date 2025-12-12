import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from '../auth/authConfig';

import { db } from '../db/schema'; // Import local db for permission overrides
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Real MSAL Auth Provider
const MsalAuthProvider = ({ children }) => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);

    useEffect(() => {
        const syncUser = async () => {
            if (isAuthenticated && accounts.length > 0) {
                const currentAccount = accounts[0];
                const email = currentAccount.username; // MSAL usually puts email here

                // 1. Base User Object
                const baseUser = {
                    name: currentAccount.name,
                    username: email,
                    id: currentAccount.homeAccountId
                };

                // 2. Fetch Local Permissions Override
                let finalRoles = ['Sitrep.Reader']; // Default role

                try {
                    const localPerm = await db.users.where('email').equals(email).first();

                    if (localPerm) {
                        // User exists in local DB, use assigned role
                        if (localPerm.role) {
                            // If they are admin locally, give them both so they don't lose basic access
                            finalRoles = [localPerm.role];
                            if (localPerm.role === 'Sitrep.Admin') {
                                finalRoles.push('Sitrep.Editor');
                            }
                        }
                    } else {
                        // Not in local DB, check domain rules? 
                        // User requested: "all personnel within company domain can view"
                        // Since we default to 'Sitrep.Reader', this is effectively done for any logged in user.
                        // We could restrict to @domain.com if needed. For now allow all authenticated.

                        // Check if MSAL claims provided roles (e.g. from Azure AD)
                        const idTokenClaims = currentAccount.idTokenClaims;
                        if (idTokenClaims && idTokenClaims.roles && idTokenClaims.roles.length > 0) {
                            finalRoles = idTokenClaims.roles;
                        }
                    }
                } catch (e) {
                    console.error("Error syncing permissions", e);
                }

                setUser(baseUser);
                setRoles(finalRoles);
            } else {
                setUser(null);
                setRoles([]);
            }
        };

        syncUser();
    }, [isAuthenticated, accounts]);

    const login = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    const logout = () => {
        instance.logoutPopup().catch(e => {
            console.error(e);
        });
    };

    const canEdit = useMemo(() => {
        if (!isAuthenticated) return false;
        return roles.includes('Sitrep.Editor') || roles.includes('Sitrep.Admin');
    }, [roles, isAuthenticated]);

    const value = {
        isAuthenticated,
        user,
        roles,
        canEdit,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Mock Auth Provider for Development
const MockAuthProvider = ({ children }) => {
    // Mock State: Always logged in as Editor
    const [isAuthenticated, setIsAuthenticated] = useState(true);
    const [user] = useState({
        name: 'Dev User',
        username: 'dev@sitrep.local',
        id: 'mock-id-123'
    });
    const roles = ['Sitrep.Editor', 'Sitrep.Admin'];

    const login = () => {
        setIsAuthenticated(true);
        console.log("Mock Login");
    };

    const logout = () => {
        setIsAuthenticated(false);
        console.log("Mock Logout");
    };

    const canEdit = useMemo(() => {
        if (!isAuthenticated) return false;
        return roles.includes('Sitrep.Editor') || roles.includes('Sitrep.Admin');
    }, [isAuthenticated, roles]);

    const value = {
        isAuthenticated,
        user: isAuthenticated ? user : null,
        roles,
        canEdit,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Main Export
export const AuthProvider = ({ children }) => {
    // Check environment variable
    const useMock = import.meta.env.VITE_USE_MOCK_AUTH === 'true';

    if (useMock) {
        return <MockAuthProvider>{children}</MockAuthProvider>;
    }
    return <MsalAuthProvider>{children}</MsalAuthProvider>;
};
