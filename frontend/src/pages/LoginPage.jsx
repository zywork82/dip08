import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import LogoLong from '../assets/logolong.png';
import '../styles/Auth.css';
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // Default role is student
  const navigate = useNavigate();

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
      // Try to parse error details from backend
      let errorMessage = "Login failed";
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Login successful:", data);

    localStorage.setItem("user", JSON.stringify(data));

    if (!toast.isActive("login-success")) {
      toast.success(`Welcome ${data.username}!`, {
        toastId: "login-success",
      });
    }

    navigate(data.role === "admin" ? "/admin" : "/student");
  } catch (error) {
    console.error("Error during login:", error);

    if (!toast.isActive("login-error")) {
      toast.error(error.message || "Something went wrong", {
        toastId: "login-error",
      });
    }
  }
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