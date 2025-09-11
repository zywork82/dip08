import React, { useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import GeneralSettings from './GeneralSettings.jsx';
import AccountSettings from './AccountSettings.jsx';
import '../styles/Settings.css';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('General');
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="settings-sidebar">
        <div className="settings-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
        </div>
        <div className="settings-nav">
          <div 
            className={`settings-nav-item ${activeTab === 'General' ? 'active' : ''}`}
            onClick={() => setActiveTab('General')}
          >
            General
          </div>
          <div 
            className={`settings-nav-item ${activeTab === 'Account' ? 'active' : ''}`}
            onClick={() => setActiveTab('Account')}
          >
            Account
          </div>
        </div>
      </div>
      <div className="settings-content">
        {activeTab === 'General' && <GeneralSettings />}
        {activeTab === 'Account' && <AccountSettings />}
      </div>
    </div>
  );
};

export default SettingsPage;