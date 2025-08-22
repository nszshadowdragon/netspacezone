import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import App from "./App"; // global wrapper with Navbar
import Landing from "./pages/LandingPage.jsx";
import Signup from "./pages/SignupPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { AuthProvider } from "./context/AuthContext";   // ✅ bring in global auth

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>   {/* ✅ now wraps the whole app */}
      <BrowserRouter>
        <Routes>
          {/* No Navbar */}
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />

          {/* With Navbar via App wrapper */}
          <Route element={<App />}>
            <Route path="/profile/:username" element={<ProfilePage />} />
            {/* Add more routes with Navbar here */}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
