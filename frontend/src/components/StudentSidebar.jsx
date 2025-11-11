import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.png';
import { FaHome, FaFolder, FaUsers, FaLaptop, FaCog, FaSignOutAlt, FaChalkboardTeacher } from 'react-icons/fa';
import '../styles/Sidebar.css';
import { useNavigate } from 'react-router-dom';

const StudentSidebar = () => {
  const location = useLocation();
   const navigate = useNavigate(); 

  const navItems = [
    { name: 'Dashboard', path: '/student', icon: <FaHome /> },
    { name: 'Case Studies', path: '/student-case-studies', icon: <FaFolder /> },
    { name: 'My Records', path: '/my-records', icon: <FaChalkboardTeacher /> },
    { name: 'Tutorial', path: '/tutorial', icon: <FaLaptop /> },
    { name: 'Settings', path: '/student-settings', icon: <FaCog /> }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
      <div className="logo-container">
        <div className="w-12 h-12">
          <img src={logo} alt="Deciwise Logo" className="logo-icon" />
        </div>

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
          <span className="profile-name">Helen Wong</span>
          <span className="profile-role">Student</span>
        </div>
        <button
          className="logout-button"
          onClick={() => {

            localStorage.clear();
            navigate('/'); // redirect to login page
          }}
        >
          <FaSignOutAlt />
        </button>
      </div>
      </div> 
    </aside>
  );
};

export default StudentSidebar;