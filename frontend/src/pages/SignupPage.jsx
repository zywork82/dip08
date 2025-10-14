import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { toast } from "react-toastify";
import LogoLong from '../assets/logolong.png'; 
import "react-toastify/dist/ReactToastify.css";

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // lets you redirect after signup

  const handleSignup = async (e) => {
    e.preventDefault();
  

    try {
      const response = await fetch("http://127.0.0.1:8000/auth/signup", {
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

      if (!toast.isActive("signup-success")) {
        toast.success("Account created successfully!", {
          toastId: "signup-success",
        });
      }

      // Redirect to login
      navigate("/");
    } catch (error) {
      console.error("Error:", error.message);

      // Prevent multiple stacked error toasts
      if (!toast.isActive("signup-error")) {
        toast.error(error.message, {
          toastId: "signup-error",
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