import { config } from '../config';

const getBaseUrl = () => {
    // If running in valid browser env, use explicit config or env var
    return config.serverUrl || import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

/**
 * Generic Fetch Wrapper
 */
async function request(endpoint, method = 'GET', data = null) {
    const baseUrl = getBaseUrl();
    // Ensure we don't double slash
    const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    const options = {
        method,
        headers
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    // Easy Auth: Cookies/Headers are handled by the browser automatically (cookies)
    // or by the App Service Proxy for incoming requests. 
    // We do NOT inject Bearer tokens manually anymore.

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
