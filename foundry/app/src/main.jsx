
import React from 'react';
import ReactDOM from 'react-dom/client';
import { seedDatabase } from './db/seed';
import { seedStoneData } from './db/seedStone';
import App from './App';
import './index.css';

// Expose seed functions to window for manual triggering
window.seedSitrep = seedDatabase;
window.seedStone = seedStoneData;

import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from './auth/authConfig';
import { AuthProvider } from './context/AuthContext';

const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === 'true';

const Root = () => {
  if (useMockAuth) {
    console.log("Using Mock Auth Provider (Dev Mode)");
    return (
      <AuthProvider>
        <App />
      </AuthProvider>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MsalProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
