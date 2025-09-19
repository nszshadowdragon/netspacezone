// frontend/src/components/ThemeSelector.jsx
import React, { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import api from "../api";

/**
 * ThemeSelector
 * - small 38x38 button
 * - cycles themes: light -> normal1 -> dark -> light
 * - updates ThemeContext via useTheme and persists to /me
 * - smooth icon animation with framer-motion if available, fallback to CSS
 */
export default function ThemeSelector({ className = "" }) {
  const { theme: ctxTheme, setTheme: ctxSetTheme, ready } = useTheme();
  const [theme, setTheme] = useState(ctxTheme || "normal1");
  const [motionLib, setMotionLib] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setTheme(ctxTheme || "normal1");
  }, [ctxTheme]);

  // dynamic import framer-motion for animation
  useEffect(() => {
    let mounted = true;
    import("framer-motion")
      .then((mod) => mounted && setMotionLib(mod))
      .catch(() => mounted && setMotionLib(null));
    return () => {
      mounted = false;
    };
  }, []);

  const persistTheme = async (newTheme) => {
    setTheme(newTheme);
    setAnimKey((k) => k + 1);

    if (typeof ctxSetTheme === "function") ctxSetTheme(newTheme);

    try {
      // non-blocking persistence
      await api.put?.("/me", { theme: newTheme });
    } catch (err) {
      console.warn("Theme save failed:", err);
    }
  };

  const cycleTheme = () => {
    const next = theme === "light" ? "normal1" : theme === "normal1" ? "dark" : "light";
    persistTheme(next);
  };

  const hints = {
    light: "Light Mode",
    normal1: "Normal Mode",
    dark: "Dark Mode",
  };

  const btnBase =
    "ts-btn inline-flex items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-offset-1";

  const getButtonStyle = () => {
    switch (theme) {
      case "light":
        return `${btnBase} bg-white text-gray-900 border-gray-200`;
      case "dark":
        return `${btnBase} bg-[#0f1724] text-white border-[#1f2937]`;
      default:
        return `${btnBase} bg-[#0b0b0b] text-white border-transparent`;
    }
  };

  // Icons
  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="ts-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1M20.66 7.34l-.71.71M4.05 19.95l-.71-.71M21 12h1M3 12H2m15.66 6.34l-.71-.71M4.05 4.05l-.71.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="ts-svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
  const StarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="ts-svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.26L21 9.27l-5 3.73L17.8 21 12 17.77 6.2 21 7 13l-5-3.73 6.1-1.01L12 2z" />
    </svg>
  );

  const IconWrapper = ({ children }) => {
    if (motionLib && motionLib.motion) {
      const { motion } = motionLib;
      const variants = {
        initial: { rotate: -90, opacity: 0, scale: 0.9 },
        animate: { rotate: 0, opacity: 1, scale: 1 },
        exit: { rotate: 90, opacity: 0, scale: 0.9 },
      };
      return (
        <motion.div
          key={animKey}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          transition={{ duration: 0.22 }}
          style={{ display: "inline-block" }}
        >
          {children}
        </motion.div>
      );
    }
    const fallbackStyle = {
      display: "inline-block",
      transform: `rotate(${animKey % 2 === 0 ? 0 : 180}deg)`,
      transition: "transform 240ms cubic-bezier(.22,.9,.35,1), opacity 220ms ease",
      opacity: 1,
    };
    return (
      <div key={animKey} style={fallbackStyle}>
        {children}
      </div>
    );
  };

  const currentIcon = () => {
    if (theme === "dark") return <MoonIcon />;
    if (theme === "light") return <SunIcon />;
    return <StarIcon />;
  };

  return (
    <button
      type="button"
      aria-label={hints[theme] || "Toggle theme"}
      title={hints[theme] || "Toggle theme"}
      aria-pressed={theme === "dark"}
      onClick={cycleTheme}
      className={`${getButtonStyle()} ${className}`}
      style={{ width: 38, height: 38 }}
    >
      <IconWrapper>{currentIcon()}</IconWrapper>
      <style>{`
        .ts-btn { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; padding: 0; }
        .ts-btn:focus { box-shadow: 0 0 0 3px rgba(250, 204, 21, .12); outline: none; }
        .ts-svg { width: 20px; height: 20px; display: block; }
      `}</style>
    </button>
  );
}
