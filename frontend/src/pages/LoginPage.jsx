import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import LogoLong from '../assets/logolong.png';
import '../styles/Auth.css';
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from 'axios';


const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // Default role is student
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
    const response = await axios.post("http://localhost:8000/auth/login", {
      email,
      password,
      role,
    });

    // Log backend response to confirm structure
    console.log("Login response:", response.data);

    const { access_token, user } = response.data;

    // ✅ Store user info properly
    const userData = {
      name: user.username,
      email: user.email,
      role: user.role,
      profileImage:
        user.profileImage ||
        "https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg",
    };

    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("userRole", user.role);

    toast.success(`Welcome ${user.username}!`);

    // ✅ Navigate based on role
    if (user.role === "admin") {
      navigate("/admin");
    } else if (user.role === "student") {
      navigate("/student");
    } else {
      navigate("/settings"); // fallback
    }
  } catch (err) {
    console.error("Login failed:", err);
    toast.error(err.response?.data?.detail || "Login failed");
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