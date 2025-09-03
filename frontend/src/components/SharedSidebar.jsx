import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import '../styles/Sidebar.css';


const SharedSidebar = () => (
  <aside className="sidebar">
    <div className="logo-container">
      <div className="w-12 h-12">
        <img src={logo} alt="Strategic Thinking Logo" className="logo-icon" />
      </div>
      <span className="logo-text">strategic thinking</span>
    </div>
    <nav className="nav-menu">
      {['Home', 'Case Studies', 'My Records', 'Tutorial', 'Settings', 'Logout'].map((item) => (
        <a key={item} href="#" className="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" className="nav-item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="font-semibold">{item}</span>
        </a>
      ))}
    </nav>
  </aside>
);

export default SharedSidebar;
