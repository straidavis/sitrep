import { createContext, useContext } from 'react';

export const DeploymentContext = createContext();

export const useDeployment = () => {
    const context = useContext(DeploymentContext);
    if (!context) {
        throw new Error('useDeployment must be used within a DeploymentProvider');
    }
    return context;
};
