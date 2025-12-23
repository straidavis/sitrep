import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Flights from './pages/Flights';
import Equipment from './pages/Equipment';
import Deployments from './pages/Deployments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Kits from './pages/Kits';

import Inventory from './pages/Inventory';
import PartsTracking from './pages/PartsTracking';
import ServiceBulletins from './pages/ServiceBulletins';

import { DeploymentProvider } from './context/DeploymentContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Admin from './pages/Admin';

// Protected Route Wrapper
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, roles } = useAuth();
  console.log('ProtectedRoute Check:', { requiredRole, isAuthenticated, roles });

  // If not authenticated, maybe show login prompt or deny?
  // relying on layout login for now, so just deny.
  if (requiredRole && (!roles || !roles.includes(requiredRole))) {
    console.warn('Access Denied in ProtectedRoute');
    return <div className="p-20 text-center text-muted">Access Denied: Admin Role Required</div>;
  }
  return children;
};

function App() {
  return (
    <DeploymentProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/flights" element={<Flights />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/deployments" element={<Deployments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/service-bulletins" element={<ServiceBulletins />} />
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="Sitrep.Admin">
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/kits" element={<Kits />} />
            <Route path="/parts" element={<PartsTracking />} />
            <Route path="/inventory" element={<Inventory />} />
          </Routes>
        </Layout>
      </Router>
    </DeploymentProvider>
  );
}

export default App;
