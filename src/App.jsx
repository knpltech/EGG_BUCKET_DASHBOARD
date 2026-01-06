// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SignIn from "./pages/SignIn";

import AdminDashboard from "./pages/AdminDashboard";
import DailyDamages from "./pages/DailyDamages";
import Neccrate from "./pages/Neccrate";
import Dailysales from "./pages/Dailysales";
import Distributor from "./pages/Distributor";
import CashPayments from "./pages/CashPayments";
import DigitalPayments from "./pages/DigitalPayments";
import Outlets from "./pages/Outlets";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import { Navigate } from "react-router-dom";

import ViewerDashboard from "./pages/ViewerDashboard";
import { DamageProvider } from "./context/DamageContext";
import { PanelProvider } from "./context/PanelContext";
import AdminLayoutWithPanel from "./layouts/AdminLayoutWithPanel";

function ProtectedRoute({ element, requiredRole }) {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {}
  const isAdmin = user && (user.role === "Admin" || (Array.isArray(user.roles) && user.roles.includes("admin")));
  const viewerRoles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  if (isAdmin || !requiredRole || viewerRoles.includes(requiredRole)) {
    return element;
  }
  // Not allowed: redirect to viewer dashboard
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <DamageProvider>
      <PanelProvider>
        <BrowserRouter>
          <Routes>
            {/* PUBLIC */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignIn />} />

            {/* ADMIN - All pages with panel layout support */}
            <Route
              path="/admin/dashboard"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><AdminDashboard /></AdminLayoutWithPanel>} requiredRole={null} />}
            />
            <Route
              path="/admin/damages"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><DailyDamages /></AdminLayoutWithPanel>} requiredRole={null} />}
            />
            <Route
              path="/admin/neccrate"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Neccrate /></AdminLayoutWithPanel>} requiredRole="neccrate" />}
            />
            <Route
              path="/admin/dailysales"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Dailysales /></AdminLayoutWithPanel>} requiredRole="daily_sales" />}
            />
            <Route
              path="/admin/distribution"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Distributor /></AdminLayoutWithPanel>} requiredRole={null} />}
            />
            <Route
              path="/admin/cash-payments"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><CashPayments /></AdminLayoutWithPanel>} requiredRole="cash_payments" />}
            />
            <Route
              path="/admin/digital-payments"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><DigitalPayments /></AdminLayoutWithPanel>} requiredRole="digital_payments" />}
            />
            <Route
              path="/admin/outlets"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Outlets /></AdminLayoutWithPanel>} requiredRole="outlets" />}
            />
            <Route
              path="/admin/users"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Users /></AdminLayoutWithPanel>} requiredRole={null} />}
            />
            <Route
              path="/admin/reports"
              element={<ProtectedRoute element={<AdminLayoutWithPanel><Reports /></AdminLayoutWithPanel>} requiredRole={null} />}
            />
            {/* VIEWER */}
            <Route path="/dashboard" element={<ViewerDashboard />} />
          </Routes>
        </BrowserRouter>
      </PanelProvider>
    </DamageProvider>
  );
}

export default App;
