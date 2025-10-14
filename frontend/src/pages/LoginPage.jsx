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
      });

      const { access_token, user } = response.data;

      // Store token and user info
      localStorage.setItem("token", access_token);
      localStorage.setItem("adminUsername", user.username);
      localStorage.setItem(
        "adminProfileImage",
        user.profileImage || "https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A"
      );
      localStorage.setItem("userRole", user.role);

      toast.success(`Welcome ${user.username}!`);

      // Navigate based on role
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/student-dashboard");
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