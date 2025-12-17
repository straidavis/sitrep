/**
 * Application Configuration
 * 
 * authMode: 'local' | 'microsoft'
 * - local: Uses internal database for authentication (email/password)
 * - microsoft: Uses Azure AD / Microsoft 365 (requires MSAL configuration)
 */

export const config = {
    authMode: 'local',

    // Microsoft 365 Configuration (if authMode is 'microsoft')
    msalConfig: {
        auth: {
            clientId: "YOUR_CLIENT_ID_HERE",
            authority: "https://login.microsoftonline.com/YOUR_TENANT_ID",
            redirectUri: window.location.origin,
        }
    }
};
