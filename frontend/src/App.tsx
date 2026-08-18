import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ClientAuthProvider } from './context/ClientAuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ClientProtectedRoute } from './components/ClientProtectedRoute';
import { ClientLayout } from './components/ClientLayout';
import { Dashboard } from './pages/Dashboard';
import { DetailsChart } from './pages/DetailsChart';
import { ClientAnalytics } from './pages/ClientAnalytics';
import { PortalHome } from './pages/PortalHome';
import { Login } from './pages/Login';
import { ClientAuth } from './pages/ClientAuth';
import { ClientActivity } from './pages/ClientActivity';
import { ClientServices } from './pages/ClientServices';
import { ClientProfile } from './pages/ClientProfile';
import { ClientManagementClients } from './pages/ClientManagementClients';
import { ClientManagementApiRequests } from './pages/ClientManagementApiRequests';
import { ClientDetails } from './pages/ClientDetails';
import { ApiSubscriptionManagement } from './pages/CostManagement';
import { UsageReports } from './pages/UsageReports';
import { ClientUsageReports } from './pages/ClientUsageReports';
import { ApiManagement } from './pages/ApiManagement';
import { CreateApi } from './pages/CreateApi';
import { EditApi } from './pages/EditApi';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClientAuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public portal selection */}
              <Route path="/" element={<PortalHome />} />

              {/* Admin login */}
              <Route path="/admin/login" element={<Login />} />
              <Route path="/login" element={<Navigate to="/admin/login" replace />} />

              {/* Client public routes */}
              <Route path="/client/login" element={<ClientAuth />} />
              <Route path="/client/register" element={<ClientAuth />} />

              {/* Admin routes */}
              <Route
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/details-chart" element={<DetailsChart />} />
                <Route path="/client-analytics" element={<ClientAnalytics />} />
                <Route path="/client-management" element={<ClientManagementClients />} />
                <Route path="/client-management/clients" element={<ClientManagementClients />} />
                <Route path="/client-management/clients/:clientId" element={<ClientDetails />} />
                <Route path="/client-management/api-requests" element={<ClientManagementApiRequests />} />
                <Route path="/api-subscription-management" element={<ApiSubscriptionManagement />} />
                <Route path="/usage-reports" element={<UsageReports />} />
                <Route path="/api-management" element={<ApiManagement />} />
                <Route path="/api-management/create" element={<CreateApi />} />
                <Route path="/api-management/edit/:id" element={<EditApi />} />
              </Route>

              {/* Client routes */}
              <Route
                path="/client"
                element={
                  <ClientProtectedRoute>
                    <ClientLayout />
                  </ClientProtectedRoute>
                }
              >
                <Route index element={<Navigate to="services" replace />} />
                <Route path="services" element={<ClientServices />} />
                <Route path="activity" element={<ClientActivity />} />
                <Route path="profile" element={<ClientProfile />} />
                <Route path="dashboard" element={<ClientActivity />} />
                <Route path="usage-reports" element={<ClientUsageReports />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ClientAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
