
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import BusinessCardJobs from './pages/BusinessCardJobs';
import BusinessCardBatches from './pages/BusinessCardBatches';
import BatchDetailsPage from './pages/BatchDetailsPage';
import BusinessCardJobNew from './pages/BusinessCardJobNew';
import FlyerJobs from './pages/FlyerJobs';
import FlyerJobNew from './pages/FlyerJobNew';
import FlyerBatches from './pages/FlyerBatches';

const ProtectedRoute = ({ element, protected: isProtected }) => {
  const { user } = useAuth();

  if (isProtected && !user) {
    return <Navigate to="/dashboard" replace />;
  }

  return element;
};

const routes = [
  {
    path: "/",
    element: <Dashboard />,
    protected: true
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
    protected: true
  },
  {
    path: "/batches/business-cards/jobs",
    element: <BusinessCardJobs />,
    protected: true
  },
  {
    path: "/batches/business-cards/jobs/new",
    element: <BusinessCardJobNew />,
    protected: true
  },
  {
    path: "/batches/business-cards/batches",
    element: <BusinessCardBatches />,
    protected: true
  },
  {
    path: "/batches/business-cards/batches/:batchId",
    element: <BatchDetailsPage productType="Business Cards" backUrl="/batches/business-cards/batches" />,
    protected: true
  },
  {
    path: "/batches/flyers/jobs",
    element: <FlyerJobs />,
    protected: true
  },
  {
    path: "/batches/flyers/jobs/new",
    element: <FlyerJobNew />,
    protected: true
  },
  {
    path: "/batches/flyers/batches",
    element: <FlyerBatches />,
    protected: true
  },
  {
    path: "/batches/flyers/batches/:batchId",
    element: <BatchDetailsPage productType="Flyers" backUrl="/batches/flyers/batches" />,
    protected: true
  },
];

function App() {
  return (
    <Router>
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={<ProtectedRoute element={route.element} protected={route.protected} />}
          />
        ))}
      </Routes>
    </Router>
  );
}

export default App;
