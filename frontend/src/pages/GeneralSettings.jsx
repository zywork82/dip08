import React, { useState } from 'react';
import '../styles/Settings.css';

const GeneralSettings = () => {
  const [language, setLanguage] = useState('English');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [volume, setVolume] = useState(100);
  const [brightness, setBrightness] = useState(50);

  const handleSignOut = () => {
    console.log('User signed out.');
  };

  return (
    <div className="general-settings">
      <h2 className="content-title">Settings</h2>
      <div className="settings-card">
        <h3 className="card-title">General</h3>
        <div className="setting-row">
          <label className="setting-label">Language</label>
          <select className="setting-dropdown" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="English">English</option>
            <option value="Chinese">Chinese</option>
          </select>
        </div>
        <div className="setting-row">
          <label className="setting-label">Display</label>
          <div className="toggle-switch-container">
            <span className="toggle-label">Dark Mode</span>
            <input type="checkbox" id="darkModeToggle" checked={isDarkMode} onChange={() => setIsDarkMode(!isDarkMode)} />
            <label htmlFor="darkModeToggle" className="toggle-label-switch"></label>
          </div>
        </div>
        <div className="setting-row">
          <label className="setting-label">Volume</label>
          <div className="slider-container">
            <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(e.target.value)} className="slider" />
            <span className="slider-value">{volume}%</span>
          </div>
        </div>
        <div className="setting-row">
          <label className="setting-label">Brightness</label>
          <div className="slider-container">
            <input type="range" min="0" max="100" value={brightness} onChange={(e) => setBrightness(e.target.value)} className="slider" />
            <span className="slider-value">{brightness}%</span>
          </div>
        </div>
      </div>
      <div className="sign-out-container">
        <button className="sign-out-button" onClick={handleSignOut}>Sign Out</button>
      </div>
    </div>
  );
};

export default GeneralSettings;