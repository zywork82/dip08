import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import LogoLong from '../assets/logolong.png';
import '../styles/Auth.css';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = (e) => {
    e.preventDefault();
    // Here you would make an API call to your backend
    console.log('Signing up with:', { name, email, password });
  };

  return (
    <AuthLayout>
      <div className="auth-form-content">
         <div className="logo-container">
                 {LogoLong && <img src={LogoLong} alt="DeciWise Logo" className="logo-icon" />}
               </div>
        <form onSubmit={handleSignup}>
          <h3>Create Account</h3>
          <div className="form-group">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
          <button type="submit">Sign Up</button>
        </form>
        <p>
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default SignupPage;