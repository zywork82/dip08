import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import { FaHome, FaFolder, FaUsers, FaLaptop, FaCog, FaSignOutAlt, FaChalkboardTeacher } from 'react-icons/fa';
import '../styles/Sidebar.css';

const SharedSidebar = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <FaHome /> },
    { name: 'Case Studies', path: '/case-studies', icon: <FaFolder /> },
    { name: 'Trainer Team', path: '/trainer-team', icon: <FaUsers /> },
    { name: 'Trainee Records', path: '/trainee-records', icon: <FaChalkboardTeacher /> },
    { name: 'Tutorial', path: '/tutorial', icon: <FaLaptop /> },
    { name: 'Settings', path: '/settings', icon: <FaCog /> }
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="w-8 h-8">
          <img src={logo} alt="Deciwise Logo" className="logo-icon" />
        </div>
        <span className="logo-text">Deciwise</span>
      </div>
      <nav className="nav-menu">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <div className="nav-item-icon">{item.icon}</div>
            <span className="font-semibold">{item.name}</span>
          </Link>
        ))}
      </nav>
      <div className="profile-section">
        <div className="profile-info">
          <span className="profile-name">Prof Andy</span>
          <span className="profile-role">Administrator</span>
        </div>
        <button className="logout-button">
          <FaSignOutAlt />
        </button>
      </div>
    </aside>
  );
};

export default SharedSidebar;