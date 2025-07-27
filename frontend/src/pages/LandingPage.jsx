// src/pages/LandingPage.jsx
import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";
import axios from "../api";
import { useAuth } from "../context/AuthContext";

export default function LandingPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading]       = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleCheckboxChange = () => setRememberMe(v => !v);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Please fill out both fields.");
      return;
    }
    setLoading(true);

    // Build login payload
    const payload = identifier.includes("@")
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

    try {
      // 1) Try normal login
      const response = await axios.post("/login", payload);
      const data = response.data;
      if (!data.token) throw new Error("Invalid login response");

      await login({ token: data.token, user: null });
      navigate("/home", { replace: true });

    } catch (err) {
      // 2) If account suspended, offer reactivation
      if (err.response?.status === 403) {
        const doReactivate = window.confirm(
          "Your account is suspended. Reactivate now?"
        );
        if (doReactivate) {
          try {
            // Reactivate account
            await axios.post("/reactivate", {
              email: identifier.trim(),
            });

            // Immediately re-login
            const relog = await axios.post("/login", payload);
            const rd = relog.data;
            if (!rd.token) throw new Error("Re-login failed");

            await login({ token: rd.token, user: null });
            navigate("/home", { replace: true });
            return;

          } catch (err2) {
            console.error("Reactivation/login failed:", err2.response || err2);
            toast.error(
              err2.response?.data?.message ||
              "Reactivation or login failed. Please contact support."
            );
            return;
          }
        }
        // If user cancels reactivation, just return
        return;
      }

      // 3) Other login errors
      console.error("Login error:", err.response || err);
      toast.error(
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please check your credentials."
      );

    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (platform) => {
    toast.info(`${platform} login – placeholder`);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white">
      <Helmet>
        <title>Welcome to NetSpace Zone</title>
        <meta name="description" content="Secure login for NSZ" />
      </Helmet>
      <ToastContainer />

      {/* Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1950&q=80')",
        }}
      />

      {/* Foreground */}
      <div className="relative z-10 flex flex-col md:flex-row w-full h-full max-w-7xl mx-auto">
        {/* Left: Big Heading */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-md transform -rotate-3"
          >
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-300 to-pink-400 drop-shadow-xl leading-tight">
              Welcome to <br />
              <span className="text-white">NetSpace Zone</span>
            </h1>
          </motion.div>
        </div>

        {/* Right: Login Box */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4">
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="bg-black/70 p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-md"
          >
            <h2 className="text-2xl font-bold mb-4 text-center">Sign In</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 font-semibold">Username / Email</label>
                <input
                  type="text"
                  placeholder="Username or Email"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full p-2 rounded text-black"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-2 rounded text-black"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleCheckboxChange}
                    className="mr-1"
                  />
                  Remember Me
                </label>
                <button
                  type="button"
                  onClick={() => toast.info("Forgot Password?")}
                  className="text-blue-400 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Logging in…" : "Login"}
              </button>
            </form>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => handleSocialLogin("Google")}
                className="w-full bg-red-500 py-2 rounded hover:bg-red-600 text-white"
              >
                Login with Google
              </button>
              <button
                onClick={() => handleSocialLogin("Facebook")}
                className="w-full bg-blue-700 py-2 rounded hover:bg-blue-800 text-white"
              >
                Login with Facebook
              </button>
              <button
                onClick={() => handleSocialLogin("Twitter")}
                className="w-full bg-blue-400 py-2 rounded hover:bg-blue-500 text-white"
              >
                Login with Twitter
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => navigate("/signup")}
                className="text-blue-400 hover:underline"
              >
                Don’t have an account? Sign Up
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
