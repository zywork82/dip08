import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate(); // lets you redirect after signup

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch("http://127.0.0.1:8000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
        email: email,
        username: name,  
        password: password,
       })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Signup failed");
      }

      const data = await response.json();
      console.log("Signup successful:", data);
      setSuccess("Account created successfully!");

      // optional: redirect to login page after 1.5s
      setTimeout(() => navigate("/"), 1500);

    } catch (err) {
      console.error("Error during signup:", err);
      setError(err.message || "Something went wrong");
    }
  };
  return (
    <AuthLayout>
      <div className="auth-form-content">
        <div className="logo-container">
          <h2>strategic thinking</h2>
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