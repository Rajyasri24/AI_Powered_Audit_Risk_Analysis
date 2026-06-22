import { Routes, Route } from "react-router-dom";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./routes/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import UploadPage from "./pages/UploadPage";
import DatasetsPage from "./pages/DatasetsPage";
import RulesPage from "./pages/RulesPage";
import AnalysisPage from "./pages/AnalysisPage";
import InvestigationPage from "./pages/InvestigationPage";
import VendorRiskPage from "./pages/VendorRiskPage";
import NetworkPage from "./pages/NetworkPage";
import ReportsPage from "./pages/ReportsPage";
import CopilotPage from "./pages/CopilotPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/datasets" element={<DatasetsPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/investigation" element={<InvestigationPage />} />
        <Route path="/vendor-risk" element={<VendorRiskPage />} />
        <Route path="/network" element={<NetworkPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/copilot" element={<CopilotPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}