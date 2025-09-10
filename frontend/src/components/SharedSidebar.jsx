import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import { FaHome, FaBook, FaUserGraduate, FaLaptop, FaCog, FaSignOutAlt } from 'react-icons/fa';
import '../styles/Sidebar.css';

const SharedSidebar = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/', icon: <FaHome /> },
    { name: 'Case Studies', path: '/case-studies', icon: <FaBook /> },
    { name: 'My Records', path: '/trainee-records', icon: <FaUserGraduate /> }, 
    { name: 'Tutorial', path: '/tutorial', icon: <FaLaptop /> },
    { name: 'Settings', path: '/settings', icon: <FaCog /> },
    { name: 'Logout', path: '/logout', icon: <FaSignOutAlt /> }
  ];

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="w-12 h-12">
          <img src={logo} alt="Strategic Thinking Logo" className="logo-icon" />
        </div>
        <span className="logo-text">strategic thinking</span>
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
    </aside>
  );
};

export default SharedSidebar;