// src/components/NavigationBar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/SlimNavBar.css';

// Using common icons that you might have from a library like react-icons or equivalent
// If you don't have these, you can replace them with simple letters or SVGs
const NavItem = ({ to, icon: Icon, label }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <div
      className={`nav-item ${isActive ? 'active' : ''}`}
      onClick={() => navigate(to)}
      title={label}
    >
      {/* Replace 'Icon' with a simple <div> or appropriate icon component */}
      <div className="nav-icon">{Icon}</div>
    </div>
  );
};

const NavigationBar = () => {
  if (localStorage.getItem('userRole') === 'admin')
  {
    return (
      <div className="navigation-bar-container">
        {/* Application Logo/Header (e.g., Chess Rook Icon) */}
        <div className="app-logo">
          {/* Placeholder for your chess rook image/SVG */}
          <span role="img" aria-label="app logo">♟️</span>
        </div>

        {/* Main Navigation Items */}
        <div className="nav-items-group main-nav">
          <NavItem 
            to="/admin" 
            icon="🏠" // Home/Scenario Flow Editor
            label="Admin Dashboard"
          />
          <NavItem 
            to="/scene-editor" 
            icon="🖼️" // Scene/Image Editor
            label="Scene Editor"
          />
          {/* <NavItem 
            to="/reporting" 
            icon="📊" // Reporting/Analytics
            label="Reporting"
          /> */}
          <NavItem 
            to="/trainee-records" 
            icon="👥" // User Management
            label="User Management"
          />
        </div>

        {/* Settings/Configuration Item */}
        <div className="nav-items-group settings-nav">
          <NavItem 
            to="/settings" 
            icon="⚙️" // Settings
            label="Settings"
          />
        </div>
      </div>
    );
  }

  else 
  {
    return (
      <div className="navigation-bar-container">
        {/* Application Logo/Header (e.g., Chess Rook Icon) */}
        <div className="app-logo">
          {/* Placeholder for your chess rook image/SVG */}
          <span role="img" aria-label="app logo">♟️</span>
        </div>

        {/* Main Navigation Items */}
        <div className="nav-items-group main-nav">
          <NavItem 
            to="/student" 
            icon="🏠" // Home/Scenario Flow Editor
            label="Student Dashboard"
          />
        </div>

        {/* Settings/Configuration Item */}
        <div className="nav-items-group settings-nav">
          <NavItem 
            to="/settings" 
            icon="⚙️" // Settings
            label="Settings"
          />
        </div>
      </div>
    );
  }
};

export default NavigationBar;