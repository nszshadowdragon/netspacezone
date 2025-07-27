// src/components/Navbar.jsx
import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  BellAlertIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme }          from '../context/ThemeContext';
import { useAuth }           from '../context/AuthContext';
import { SearchContext }     from '../context/SearchContext';
import axios                 from '../api';

export default function Navbar() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user }  = useAuth();
  const { query, setQuery, searchResults } = useContext(SearchContext);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications,     setNotifications]     = useState([]);
  const [showMenu,          setShowMenu]          = useState(false);
  const [showSuggestions,   setShowSuggestions]   = useState(false);

  const notificationsRef = useRef(null);
  const menuRef          = useRef(null);
  const searchRef        = useRef(null);

  /* ───────────── theme helpers ───────────── */
  const getNavbarStyles = () => {
    switch (theme) {
      case 'light':  return { backgroundColor: '#14b8a6', color: '#fff' };
      case 'normal': return { background: 'linear-gradient(to right,#ff0000,#800080)', color: '#fff' };
      case 'dark':   return { backgroundColor: '#000', color: '#fff' };
      default:       return { backgroundColor: '#14b8a6', color: '#fff' };
    }
  };
  const getDropdownStyles = () =>
    theme === 'dark'
      ? { backgroundColor: '#1f2937', color: '#fff' }
      : { backgroundColor: '#fff', color: '#000' };

  /* ───────────── auth helpers ───────────── */
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('nsz_user'))
          || JSON.parse(localStorage.getItem('user'))
          || null;
    } catch { return null; }
  })();
  const authUser    = user || storedUser || {};
  const displayName = authUser.username
        ? authUser.username
        : authUser.email
          ? authUser.email.split('@')[0]
          : 'Guest';
  const avatarUrl   = authUser.profilePic || authUser.avatarUrl || '/temp-avatar.png';
  const profileRoute= authUser.username ? `/profile/${authUser.username}` : '/profile';

  const doSearch = () => { if (query.trim()) navigate('/search'); };

  /* ─────────── fetch notifications ─────────── */
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const { data } = await axios.get('/friend-requests/incoming');
      const sorted   = data.sort((a, b) => parseInt(b._id.slice(0,8),16) - parseInt(a._id.slice(0,8),16));
      setNotifications(sorted);
    } catch (err) {
      console.error('[Navbar] could not load notifications', err);
    }
  };
  useEffect(() => {
    fetchNotifications();
    return undefined; // Ensures no invalid cleanup function
  }, []);

  /* ─────────── accept / reject ─────────── */
  const handleAccept = async id => {
    try {
      await axios.post(`/friend-requests/${id}/accept`);
      setNotifications(ns => ns.filter(n => n._id !== id));
      setShowNotifications(false);
    } catch (err) {
      console.error('[Navbar] accept failed', err);
    }
  };
  const handleReject = async id => {
    try {
      await axios.post(`/friend-requests/${id}/reject`);
      setNotifications(ns => ns.filter(n => n._id !== id));
      setShowNotifications(false);
    } catch (err) {
      console.error('[Navbar] reject failed', err);
    }
  };

  /* ───────────── outside-clicks ───────────── */
  useEffect(() => {
    const handle = e => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target))
        setShowNotifications(false);
      if (menuRef.current && !menuRef.current.contains(e.target))
        setShowMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle); // Cleanup function
  }, []);

  const visibleNotifications = notifications.slice(0,5);
  const badgeText = notifications.length > 50 ? '50+' : notifications.length;

  /* ─────────────────── JSX ─────────────────── */
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 shadow border-b"
      style={getNavbarStyles()}
    >
      {/* Logo */}
      <div onClick={() => navigate('/home')} className="cursor-pointer">
        <motion.span className="font-bold text-xl">NetSpace Zone</motion.span>
      </div>

      {/* Search */}
      <div className="flex flex-1 justify-center px-2 relative">
        <div ref={searchRef} className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Type to search…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            onFocus={() => setShowSuggestions(true)}
            className="w-full py-2 px-3 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300 text-black"
          />
          <button onClick={doSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
            <MagnifyingGlassIcon className="w-5 h-5 text-black" />
          </button>

          {showSuggestions && query && (
            <div
              className="absolute top-full mt-1 w-full rounded-md shadow-lg overflow-hidden"
              style={getDropdownStyles()}
            >
              {searchResults.length === 0
                ? <div className="px-4 py-2 text-black">No matches</div>
                : searchResults.map(u => (
                    <div
                      key={u.username}
                      className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => { setQuery(''); setShowSuggestions(false); navigate(`/profile/${u.username}`); }}
                    >
                      <img
                        src={u.profilePic || '/temp-avatar.png'}
                        alt={u.username}
                        className="w-6 h-6 rounded-full mr-2 object-cover"
                      />
                      <span className="text-black">{u.username}</span>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Notifications & profile */}
      <div className="flex items-center space-x-4">
        {/* Bell */}
        <div className="relative" ref={notificationsRef}>
          <button onClick={() => setShowNotifications(v => !v)}>
            <BellAlertIcon className="w-6 h-6 text-white" />
          </button>
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full px-1">
              {badgeText}
            </span>
          )}

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity:0, y:-10 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-10 }}
                className="absolute right-0 mt-2 p-4 rounded-lg shadow-2xl border w-80 max-h-96 overflow-y-auto"
                style={getDropdownStyles()}
              >
                <button onClick={() => setShowNotifications(false)} className="absolute top-2 right-2">
                  <XMarkIcon className="w-5 h-5" />
                </button>

                {visibleNotifications.length === 0
                  ? <p>No notifications</p>
                  : (
                    <ul className="space-y-4">
                      {visibleNotifications.map(fr => (
                        <li key={fr._id} className="p-2 border rounded-md">
                          <div className="flex items-start space-x-3">
                            <img
                              src={fr.from.profilePic || '/temp-avatar.png'}
                              alt={fr.from.username}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1">
                              <p className="font-semibold">{fr.from.username}</p>
                              <p className="text-sm text-gray-600 mb-3">sent you a friend request</p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleAccept(fr._id)}
                                  className="px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded-md text-sm font-semibold"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleReject(fr._id)}
                                  className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-md text-sm font-semibold"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar & menu */}
        <div className="flex items-center space-x-2" ref={menuRef}>
          <Link to={profileRoute}>
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full border-2 border-white object-cover"
            />
          </Link>
          <span className="font-semibold">{displayName}</span>
          <button onClick={() => setShowMenu(v => !v)}>
            <Bars3Icon className="w-6 h-6" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity:0, y:-10 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-10 }}
                className="absolute right-0 top-full mt-2 p-4 rounded-lg shadow-2xl border"
                style={getDropdownStyles()}
              >
                <button onClick={() => setShowMenu(false)} className="absolute top-2 right-2">
                  <XMarkIcon className="w-5 h-5" />
                </button>
                <ul className="space-y-2">
                  <li><Link to={profileRoute} onClick={() => setShowMenu(false)}>Profile</Link></li>
                  <li><Link to="/settings" onClick={() => setShowMenu(false)}>Settings</Link></li>
                  <li><Link to="/home" onClick={() => setShowMenu(false)}>Home</Link></li>
                  <li>
                    <button className="w-full text-left" onClick={() => navigate('/logout')}>
                      Logout
                    </button>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}