import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Header.css';

const UserProfile = ({ profileImage, userName, userRole }) => (
  <div className="user-profile-container">
    <div className="user-profile-avatar">
      <img src={profileImage} alt={userName} />
    </div>
    <div className="user-profile-info">
      <span className="user-profile-name">{userName}</span>
      <span className="user-profile-role">{userRole}</span>
    </div>
  </div>
);
const SearchBar = () => (
  <div className="search-bar-container">
    <input type="text" placeholder="search for scenarios" className="search-bar-input" />
    <svg className="search-bar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
    </svg>
  </div>
);

const SharedHeader = ({ profileImage, userName, userRole }) => {
  return (
    <header className="shared-header">
      <SearchBar />
      <UserProfile
        profileImage={profileImage}
        userName={userName}
        userRole={userRole}
      />
    </header>
  );
};
export default SharedHeader;
