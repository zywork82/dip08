import React from 'react';
import { Link } from 'react-router-dom';
import { MdSearch, MdSettings, MdNotifications } from 'react-icons/md';
import '../styles/Header.css';

const SharedHeader = ({ profileImage, searchTerm, onSearchChange }) => {
 return (
    <header className="shared-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '0 20px', height: '64px', backgroundColor: '#a195bbff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
      
      <div className="user-profile-section" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/settings" className="icon-link">
          <MdSettings className="header-icon" style={{ fontSize: '1.5rem', color: '#fff' }} />
        </Link>

        <div className="icon-container">
          <MdNotifications className="header-icon" style={{ fontSize: '1.5rem', color: '#a195bbff' }} />
        </div>

        <div className="profile-image-container">
          <img src={profileImage} alt="User Profile" className="profile-image" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        </div>
      </div>
    </header>
  );
};

export default SharedHeader;