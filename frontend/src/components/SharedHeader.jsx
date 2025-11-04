import React from 'react';
import { Link } from 'react-router-dom';
import { MdSearch, MdSettings, MdNotifications } from 'react-icons/md';
import '../styles/Header.css';

const SharedHeader = ({ profileImage, searchTerm, onSearchChange }) => {
  return (
    <header className="shared-header">
      <div className="search-bar-container">
        <MdSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search for something"
          className="search-input"
          value={searchTerm}             // controlled input
          onChange={(e) => onSearchChange(e.target.value)}  // notify parent
        />
      </div>
      <div className="user-profile-section">
        <Link to="/settings" className="icon-link">
          <div className="icon-container">
            <MdSettings className="header-icon" />
          </div>
        </Link>
        <div className="icon-container">
          <MdNotifications className="header-icon" />
        </div>
        <div className="profile-image-container">
          <img src={profileImage} alt="User Profile" className="profile-image" />
        </div>
      </div>
    </header>
  );
};

export default SharedHeader;