import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // Default role is student
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

 const handleLogin = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch("http://127.0.0.1:8000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // important!
      },
      body: JSON.stringify({
        email: email,       // must match backend
        password: password, // must match backend
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Login failed");
    }

    const data = await response.json();
    console.log("Login successful:", data);
    alert(`Welcome ${data.username}, role: ${data.role}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
};
  return (
    <AuthLayout>
      <div className="auth-form-content">
        <div className="logo-container">
          {/*
            This is where your 'strategic thinking' logo goes.
            You would replace this with an <img> tag.
          */}
          <h2>strategic thinking</h2>
        </div>
        <form onSubmit={handleLogin}>
          <h3>Login</h3>
          <div className="form-group">
            <input
              type="email"
              placeholder="NTU Email"
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