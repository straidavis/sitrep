
import React from 'react';
import ReactDOM from 'react-dom/client';
import { seedDatabase } from './db/seed';
// Expose seed functions to window for manual triggering
window.seedSitrep = seedDatabase;

import App from './App';
import './index.css';

import { AuthProvider } from './context/AuthContext';

const Root = () => {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
