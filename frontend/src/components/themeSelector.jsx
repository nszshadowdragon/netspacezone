// src/components/ThemeSelector.jsx
import React, { useState, useEffect } from 'react';
import axios from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

const DEFAULT_CUSTOM_BG = "#000000";
const DEFAULT_CUSTOM_TITLE = "#ff0000";
const DEFAULT_CUSTOM_TEXT = "#ffffff";
const DEFAULT_TITLE_SIZE = 20;
const DEFAULT_CUSTOM_NAVBAR_BG = "#000000";
const DEFAULT_CUSTOM_NAVBAR_TEXT = "#ffffff";

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customBgColor, setCustomBgColor] = useState(DEFAULT_CUSTOM_BG);
  const [customTitleColor, setCustomTitleColor] = useState(DEFAULT_CUSTOM_TITLE);
  const [customTextColor, setCustomTextColor] = useState(DEFAULT_CUSTOM_TEXT);
  const [titleFontSize, setTitleFontSize] = useState(DEFAULT_TITLE_SIZE);
  const [customNavbarBg, setCustomNavbarBg] = useState(DEFAULT_CUSTOM_NAVBAR_BG);
  const [customNavbarText, setCustomNavbarText] = useState(DEFAULT_CUSTOM_NAVBAR_TEXT);

  // helper to cycle through themes _and_ persist to server
  const cycleTheme = async () => {
    const next =
      theme === 'light'  ? 'normal' :
      theme === 'normal' ? 'dark'   :
      theme === 'dark'   ? 'custom' :
      /* otherwise */     'light';

    setTheme(next);
    try {
      await axios.put('/me', { theme: next });
    } catch (err) {
      console.error('Could not save theme:', err);
    }
  };

  // when saving custom palette, persist and close modal
  const saveCustom = async () => {
    setShowCustomModal(false);
    setTheme('custom');
    try {
      await axios.put('/me', { theme: 'custom' });
    } catch (err) {
      console.error('Could not save custom theme:', err);
    }
  };

  const hints = {
    light:  "Light Mode: White background, black text",
    normal: "Normal Mode: Red-to-purple gradient, white text boxes",
    dark:   "Dark Mode: Black background, white text",
    custom: "Custom Mode: Your own colors"
  };

  const variants = {
    initial: { rotate: -90, opacity: 0 },
    animate: { rotate:   0, opacity: 1 },
    exit:    { rotate:  90, opacity: 0 },
  };

  const getButtonClass = () => {
    switch (theme) {
      case "light":
        return "px-4 py-2 rounded bg-white text-gray-900 border hover:bg-gray-100";
      case "dark":
        return "px-4 py-2 rounded bg-gray-900 text-gray-50 border hover:bg-gray-800";
      default:
        return "px-4 py-2 rounded bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700";
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
      case 'normal':
        return (
          <AnimatePresence mode="wait">
            <motion.div key="sun" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
              {/* sun icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m8.66-11.66l-.71.71M4.05 4.05l-.71.71M21 12h1M3 12H2
                     m15.66 6.34l-.71-.71M4.05 19.95l-.71-.71
                     M16 12 a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </motion.div>
          </AnimatePresence>
        );
      case 'dark':
        return (
          <AnimatePresence mode="wait">
            <motion.div key="moon" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
              {/* moon icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
              </svg>
            </motion.div>
          </AnimatePresence>
        );
      case 'custom':
        return (
          <AnimatePresence mode="wait">
            <motion.div key="palette" variants={variants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4 }}>
              {/* palette icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.21 1.79 4 4 4h.31a1 1 0 01.95 1.32
                         A2.982 2.982 0 0010 19c1.66 0 3-1.34 3-3
                         0-.55-.45-1-1-1H9a1 1 0 01-1-1
                         c0-1.1.9-2 2-2h5c2.21 0 4-1.79 4-4
                         0-4.97-4.48-9-10-9z" />
              </svg>
            </motion.div>
          </AnimatePresence>
        );
      default:
        return null;
    }
  };

  // (re-inject theme styles into DOM—unchanged)
  useEffect(() => {
    // ... your existing logic here ...
  }, [theme, customBgColor, customTitleColor, customTextColor, titleFontSize, customNavbarBg, customNavbarText]);

  return (
    <div className="fixed top-[94px] right-4 z-30">
      {theme !== "custom" ? (
        <button onClick={cycleTheme} className={getButtonClass()} title={hints[theme]}>
          {getThemeIcon()}
        </button>
      ) : (
        <div className="flex space-x-2">
          <button onClick={() => setShowCustomModal(true)} className={getButtonClass()}>
            customize?
          </button>
          <button onClick={cycleTheme} className={getButtonClass()} title={hints[theme]}>
            {getThemeIcon()}
          </button>
        </div>
      )}

      {showCustomModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="bg-white p-6 rounded shadow-lg w-full max-w-[75vw] max-h-[75vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Customize Theme</h2>
            {/* …your color-picker controls here… */}
            <div className="flex space-x-2 mt-4">
              <button
                onClick={() => {
                  setCustomBgColor(DEFAULT_CUSTOM_BG);
                  setCustomTitleColor(DEFAULT_CUSTOM_TITLE);
                  setCustomTextColor(DEFAULT_CUSTOM_TEXT);
                  setTitleFontSize(DEFAULT_TITLE_SIZE);
                  setCustomNavbarBg(DEFAULT_CUSTOM_NAVBAR_BG);
                  setCustomNavbarText(DEFAULT_CUSTOM_NAVBAR_TEXT);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              >
                Reset Defaults
              </button>
              <button
                onClick={saveCustom}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
