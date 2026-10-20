import React, { useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import RoleModal from './components/RoleModal';
import DecisionTransparencyModal from './components/DecisionTransparencyModal';
import CommandCenter from './pages/CommandCenter';
import DataPage from './pages/DataPage';
import SystemStatus from './pages/SystemStatus';
import AdminPage from './pages/AdminPage';
import SiuQueue from './pages/SiuQueue';
import InvestigationBrief from './pages/InvestigationBrief';
import DemoMode from './pages/DemoMode';
import NetworkExplorer from './pages/NetworkExplorer';
import ClaimsIntelligence from './pages/ClaimsIntelligence';
import RiskForecast from './pages/RiskForecast';

export default function App() {
  const [currentRole, setCurrentRole] = useState('Investigator');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isTransparencyModalOpen, setIsTransparencyModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('command-center');
  const [horizon, setHorizon] = useState(30);
  const [activeCaseId, setActiveCaseId] = useState(null);

  const handleSelectRole = (role) => {
    setCurrentRole(role);
    setIsRoleModalOpen(false);
  };

  const handleOpenCase = (caseId) => {
    setActiveCaseId(caseId);
    setActiveTab('investigations');
  };

  const handleRouteSearchResult = (type, id) => {
    if (type === 'case') {
      handleOpenCase(id);
    } else if (type === 'claim') {
      setActiveTab('claims');
    } else if (type === 'provider' || type === 'facility') {
      setActiveTab('network');
    } else if (type === 'member') {
      setActiveTab('claims');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenter onNavigate={setActiveTab} horizon={horizon} onOpenCase={handleOpenCase} />;
      case 'data':
        return <DataPage />;
      case 'system-status':
        return <SystemStatus />;
      case 'administration':
        return <AdminPage />;
      case 'siu-queue':
        return <SiuQueue onSelectCase={handleOpenCase} activeHorizon={horizon} />;
      case 'investigations':
        return (
          <InvestigationBrief
            caseId={activeCaseId || 'CS-0001'}
            horizon={horizon}
            currentRole={currentRole}
          />
        );
      case 'demo-mode':
        return <DemoMode onOpenCase={handleOpenCase} />;
      case 'network':
        return <NetworkExplorer onSelectCase={handleOpenCase} />;
      case 'claims':
        return <ClaimsIntelligence onOpenCase={handleOpenCase} />;
      case 'risk-forecast':
        return <RiskForecast horizon={horizon} onNavigate={setActiveTab} />;
      default:
        return <CommandCenter onNavigate={setActiveTab} horizon={horizon} onOpenCase={handleOpenCase} />;
    }
  };

  return (
    <div className="app-container">
      {/* Persistent Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentRole={currentRole}
        activeCaseId={activeCaseId}
      />

      {/* Main Analytical Work Area */}
      <div className="app-main">
        <TopBar
          currentRole={currentRole}
          onOpenRoleModal={() => setIsRoleModalOpen(true)}
          horizon={horizon}
          onSelectHorizon={setHorizon}
          onOpenTransparencyModal={() => setIsTransparencyModalOpen(true)}
          onRouteSearchResult={handleRouteSearchResult}
        />

        {renderContent()}
      </div>

      {/* Persona Selection Modal */}
      <RoleModal
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />

      {/* Decision Transparency & Responsible AI Modal */}
      <DecisionTransparencyModal
        isOpen={isTransparencyModalOpen}
        onClose={() => setIsTransparencyModalOpen(false)}
      />
    </div>
  );
}
