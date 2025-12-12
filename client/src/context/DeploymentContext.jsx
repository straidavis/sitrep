import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllDeployments } from '../db/deployments';

const DeploymentContext = createContext();

export const useDeployment = () => {
    const context = useContext(DeploymentContext);
    if (!context) {
        throw new Error('useDeployment must be used within a DeploymentProvider');
    }
    return context;
};

export const DeploymentProvider = ({ children }) => {
    const [selectedDeploymentIds, setSelectedDeploymentIds] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDeployments();
    }, []);

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

            // Default to loading "All Active Deployments"
            // If no active deployments, maybe select nothing or all? 
            // The prompt says: "default to loading 'All Active Deployments'."
            const activeIds = sortedData
                .filter(d => d.status === 'Active')
                .map(d => d.id);

            // Only set default if we haven't set it before (or maybe we should reset? usually context init resets)
            // But we might want to persist? For now sticking to simple init.
            if (activeIds.length > 0) {
                setSelectedDeploymentIds(activeIds);
            } else {
                setSelectedDeploymentIds([]);
            }

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
        refreshDeployments
    };

    return (
        <DeploymentContext.Provider value={value}>
            {children}
        </DeploymentContext.Provider>
    );
};
