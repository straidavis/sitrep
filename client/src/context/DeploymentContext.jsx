import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllDeployments } from '../db/deployments';

import { useAuth } from './AuthContext';

const DeploymentContext = createContext();

export const useDeployment = () => {
    const context = useContext(DeploymentContext);
    if (!context) {
        throw new Error('useDeployment must be used within a DeploymentProvider');
    }
    return context;
};

export const DeploymentProvider = ({ children }) => {
    const { user } = useAuth();
    const [selectedDeploymentIds, setSelectedDeploymentIds] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deployerWarning, setDeployerWarning] = useState(false);

    useEffect(() => {
        loadDeployments();
    }, [user]); // Reload if user changes

    const loadDeployments = async () => {
        try {
            setLoading(true);
            const data = await getAllDeployments();

            // Sort deployments: Active/Planning first, then others
            // Order: Active (1), Planning (2), Completed (3), Cancelled (4)
            const statusOrder = { 'Active': 1, 'Planning': 2, 'Completed': 3, 'Cancelled': 4 };

            const sortedData = data.sort((a, b) => {
                const scoreA = statusOrder[a.status] || 99;
                const scoreB = statusOrder[b.status] || 99;
                if (scoreA !== scoreB) return scoreA - scoreB;
                // Secondary sort by date (descending)
                return new Date(b.startDate) - new Date(a.startDate);
            });

            setDeployments(sortedData);

            // LOGIC: Select Default Deployments
            if (user && user.username) {
                const email = user.username.toLowerCase();

                // Find deployments assigned to this user
                const assigned = sortedData.filter(d => {
                    const emails = Array.isArray(d.userEmails)
                        ? d.userEmails
                        : (d.userEmails ? String(d.userEmails).split(',') : []);

                    return emails.some(e => e.trim().toLowerCase() === email);
                });

                if (assigned.length > 0) {
                    // Check for Active Assigned
                    const activeAssigned = assigned.filter(d => d.status === 'Active');

                    if (activeAssigned.length > 0) {
                        setSelectedDeploymentIds(activeAssigned.map(d => d.id));
                        setDeployerWarning(activeAssigned.length > 1);
                    } else {
                        // No active assigned? Select first assigned (e.g. Planning)
                        setSelectedDeploymentIds([assigned[0].id]);
                        setDeployerWarning(false);
                    }
                    setLoading(false);
                    return;
                }
            }

            // Fallback (General User / Admin or Unassigned): Select All Active
            const activeIds = sortedData
                .filter(d => d.status === 'Active')
                .map(d => d.id);

            if (activeIds.length > 0) {
                setSelectedDeploymentIds(activeIds);
            } else {
                setSelectedDeploymentIds([]);
            }
            setDeployerWarning(false);

        } catch (error) {
            console.error('Error loading deployments:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshDeployments = async () => {
        await loadDeployments();
    };

    const value = {
        selectedDeploymentIds,
        setSelectedDeploymentIds,
        deployments,
        loading,
        deployerWarning,
        refreshDeployments
    };

    return (
        <DeploymentContext.Provider value={value}>
            {children}
        </DeploymentContext.Provider>
    );
};
