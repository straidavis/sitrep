import { msalInstance } from '../auth/authConfig';
import { config } from '../config';

const getBaseUrl = () => {
    // If running in valid browser env, use explicit config or env var
    return config.serverUrl || import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

/**
 * Acquire Access Token for API
 */
async function getAuthToken() {
    if (config.authMode !== 'microsoft') return null;

    // Ensure MSAL is initialized
    if (!msalInstance) return null;

    const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
    if (!account) return null;

    try {
        const response = await msalInstance.acquireTokenSilent({
            scopes: ["User.Read"], // TODO: Replace with your actual API Scope e.g. ["api://<client-id>/access_as_user"]
            account: account
        });
        return response.accessToken;
    } catch (err) {
        console.warn("Silent token acquisition failed. Interaction might be required.", err);
        return null;
    }
}

/**
 * Generic Fetch Wrapper
 */
async function request(endpoint, method = 'GET', data = null) {
    const baseUrl = getBaseUrl();
    // Ensure we don't double slash
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const token = await getAuthToken();

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        // Fallback for API Key if configured (Legacy/Local)
        if (config.apiKey) headers['X-API-Key'] = config.apiKey;
    }

    const options = {
        method,
        headers
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

export const api = {
    get: (endpoint) => request(endpoint, 'GET'),
    post: (endpoint, data) => request(endpoint, 'POST', data),
    put: (endpoint, data) => request(endpoint, 'PUT', data),
    delete: (endpoint) => request(endpoint, 'DELETE')
};
