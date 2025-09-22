import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import LogoLong from '../assets/logolong.png';
import '../styles/Auth.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // Default role is student

  const handleLogin = (e) => {
    e.preventDefault();
    // Here you would make an API call to your backend
    console.log('Logging in with:', { email, password, role });
  };

  return (
    <AuthLayout>
      <div className="auth-form-content">
        <div className="logo-container">
          {LogoLong && <img src={LogoLong} alt="DeciWise Logo" className="logo-icon" />}
        </div>
        <form onSubmit={handleLogin}>
          <h3>Login</h3>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="forgot-password">
            <a href="/forgot-password">Forgot your password?</a>
          </div>
          <div className="role-options">
            <label>
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === 'admin'}
                onChange={() => setRole('admin')}
              /> Admin
            </label>
            <label>
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === 'student'}
                onChange={() => setRole('student')}
              /> Student
            </label>
          </div>
          <button type="submit">Login</button>
        </form>
        <p>
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;