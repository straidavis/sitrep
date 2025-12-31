import React, { useState, useEffect } from 'react';
import { getAllDeployments } from '../db/deployments';
import { useAuth } from './useAuth'; // Use the hook from separate file
import { DeploymentContext } from './useDeployment';

export const DeploymentProvider = ({ children }) => {
    const { user, roles } = useAuth();
    const [selectedDeploymentIds, setSelectedDeploymentIds] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deployerWarning, setDeployerWarning] = useState(false);

    useEffect(() => {
        loadDeployments();
    }, [user, roles]); // Reload if user/roles change

    // Keep warning in sync with selection
    useEffect(() => {
        setDeployerWarning(selectedDeploymentIds.length > 1);
    }, [selectedDeploymentIds]);

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

            // FILTER: Removed to allow Global Read Access.
            // All users see ALL deployments.
            let visibleDeployments = sortedData;

            setDeployments(visibleDeployments);

            // LOGIC: Select Default Deployments
            // If we filtered, the user only has assigned ones anyway.
            // If Admin, fall back to Active.

            if (visibleDeployments.length > 0) {
                // Try to keep existing selection if valid
                const validSelection = selectedDeploymentIds.filter(id => visibleDeployments.find(d => d.id === id));
                if (validSelection.length > 0) {
                    setSelectedDeploymentIds(validSelection);
                } else {
                    // Default Logic

                    // 1. Find deployments explicitly assigned to ME (even if Admin sees all)
                    const myEmail = (user?.username || '').toLowerCase();
                    const assignedToMe = visibleDeployments.filter(d => {
                        const emails = Array.isArray(d.userEmails)
                            ? d.userEmails
                            : (d.userEmails ? String(d.userEmails).split(',') : []);
                        return emails.some(e => e.trim().toLowerCase() === myEmail);
                    });

                    // 2. Determine Scope: Assigned Only -> All Visible
                    // Non-admins already have visibleDeployments set to assignedToMe, so this logic is safe for both.
                    const targetList = assignedToMe.length > 0 ? assignedToMe : visibleDeployments;

                    // 3. Filter for Active
                    const activeTarget = targetList.filter(d => d.status === 'Active');

                    if (activeTarget.length > 0) {
                        setSelectedDeploymentIds(activeTarget.map(d => d.id));
                        setDeployerWarning(activeTarget.length > 1);
                    } else if (targetList.length > 0) {
                        // Fallback to first available (e.g. Planning)
                        setSelectedDeploymentIds([targetList[0].id]);
                        setDeployerWarning(false);
                    } else {
                        // Total fallback if nothing matches (should happen for purely new users with no assignment)
                        // If Admin and no deployments exist, empty.
                        setSelectedDeploymentIds([]);
                    }
                }
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
        deployerWarning,
        refreshDeployments
    };

    return (
        <DeploymentContext.Provider value={value}>
            {children}
        </DeploymentContext.Provider>
    );
};
