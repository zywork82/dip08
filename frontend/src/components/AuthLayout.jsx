import React from 'react';
import '../styles/Auth.css';
import authIllustration from '../assets/auth-illustration.png';
const AuthLayout = ({ children }) => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        {children}
      </div>
      <div className="auth-illustration">
        <img src={authIllustration} alt="Strategic Thinking Illustration" />
      </div>
    </div>
  );
};

export default AuthLayout;