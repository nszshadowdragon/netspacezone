// src/components/RecommendedUsers.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import {
  BellSlashIcon,
  XMarkIcon,
  ArrowPathIcon,
  ArrowsUpDownIcon,
  HandRaisedIcon,
  UsersIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/outline';

// Shared button style
const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

// Theme‐aware container styles
const getRecommendedUsersStyle = (theme) => {
  switch (theme) {
    case 'light':
      return { backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e5e7eb' };
    case 'normal':
      return { background: 'linear-gradient(to right, #ff0000, #800080)', color: '#ffffff', border: '1px solid #e5e7eb' };
    case 'dark':
      return { backgroundColor: '#000000', color: '#ffffff', border: '1px solid #e5e7eb' };
    case 'custom':
      return { backgroundColor: '#ff0000', color: '#ffffff', border: '1px solid #e5e7eb' };
    default:
      return {};
  }
};

function getScrollBoxBackground(theme) {
  return theme === 'custom' ? '#000000' : '#14b8a6';
}

const popupVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.7 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 20 } },
  exit: { opacity: 0, y: 30, scale: 0.7 },
};

export default function RecommendedUsers({ recommendedUsers = [] }) {
  const { theme } = useTheme();
  const containerStyle = getRecommendedUsersStyle(theme);

  // Persisted hide/show
  const [visible, setVisible] = useState(() => localStorage.getItem('recommendedHidden') !== 'true');

  // Local state
  const [localUsers, setLocalUsers]       = useState(recommendedUsers);
  const [filterText, setFilterText]       = useState('');
  const [sortOption, setSortOption]       = useState('name');
  const [detailedView, setDetailedView]   = useState(false);
  const [animStyle, setAnimStyle]         = useState('flip');
  const [showPopup, setShowPopup]         = useState(false);
  const [popupMsg, setPopupMsg]           = useState('');
  const [ariaMsg, setAriaMsg]             = useState('');

  // Hide / Show handlers
  const handleHide = () => {
    localStorage.setItem('recommendedHidden', 'true');
    setVisible(false);
  };
  const handleShow = () => {
    localStorage.removeItem('recommendedHidden');
    setVisible(true);
  };

  // Snooze 24H
  const handleSnooze = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('recommendedSnoozedUntil', until.toString());
    setPopupMsg('Recommendations Paused\nfor 24HRS');
    setAriaMsg('Recommendations Paused for 24 hours');
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 2000);
  };

  // Refresh shuffle
  const handleRefresh = () => {
    setLocalUsers(u => [...u].sort(() => 0.5 - Math.random()));
    setPopupMsg('Recommendations Refreshed');
    setAriaMsg('Recommendations Refreshed');
    setShowPopup(true);
    setTimeout(() => setShowPopup(false), 2000);
  };

  // Append your original 16 placeholders on mount
  useEffect(() => {
    setLocalUsers(prev => [
      ...prev,
      { id: 317, name: 'Xander', avatar: '/images/avatar-xander.png', type: 'user', mutualFriends: 2, verified: false, online: true, isNew: true, bio: 'Music producer', followers: 130 },
      { id: 318, name: 'Yasmine', avatar: '/images/avatar-yasmine.png', type: 'user', mutualFriends: 3, verified: true, online: false, isNew: false, bio: 'Fashion influencer', followers: 210 },
      { id: 319, name: 'Zane', avatar: '/images/avatar-zane.png', type: 'user', mutualFriends: 1, verified: false, online: true, isNew: false, bio: 'Travel blogger', followers: 95 },
      { id: 320, name: 'Avery', avatar: '/images/avatar-avery.png', type: 'user', mutualFriends: 4, verified: true, online: true, isNew: false, bio: 'Entrepreneur', followers: 180 },
      { id: 321, name: 'Brandon', avatar: '/images/avatar-brandon.png', type: 'group', mutualFriends: 2, verified: false, online: false, isNew: false, bio: 'Sports fans', followers: 150 },
      { id: 322, name: 'Cynthia', avatar: '/images/avatar-cynthia.png', type: 'content', mutualFriends: 1, verified: true, online: true, isNew: true, bio: 'DIY specialist', followers: 140 },
      { id: 323, name: 'Derek', avatar: '/images/avatar-derek.png', type: 'user', mutualFriends: 3, verified: false, online: true, isNew: false, bio: 'Photographer', followers: 160 },
      { id: 324, name: 'Elena', avatar: '/images/avatar-elena.png', type: 'user', mutualFriends: 2, verified: true, online: false, isNew: false, bio: 'Food blogger', followers: 170 },
      { id: 325, name: 'Felix', avatar: '/images/avatar-felix.png', type: 'group', mutualFriends: 4, verified: false, online: true, isNew: false, bio: 'Tech enthusiasts', followers: 190 },
      { id: 326, name: 'Gloria', avatar: '/images/avatar-gloria.png', type: 'content', mutualFriends: 3, verified: true, online: true, isNew: true, bio: 'Art curator', followers: 120 },
      { id: 327, name: 'Hector', avatar: '/images/avatar-hector.png', type: 'user', mutualFriends: 2, verified: false, online: false, isNew: false, bio: 'Musician', followers: 110 },
      { id: 328, name: 'Isabella', avatar: '/images/avatar-isabella.png', type: 'user', mutualFriends: 5, verified: true, online: true, isNew: false, bio: 'Travel photographer', followers: 230 },
      { id: 329, name: 'Jonas', avatar: '/images/avatar-jonas.png', type: 'group', mutualFriends: 1, verified: false, online: true, isNew: false, bio: 'Book club', followers: 80 },
      { id: 330, name: 'Kendra', avatar: '/images/avatar-kendra.png', type: 'content', mutualFriends: 3, verified: true, online: false, isNew: true, bio: 'Blogger', followers: 140 },
      { id: 331, name: 'Liam', avatar: '/images/avatar-liam.png', type: 'user', mutualFriends: 4, verified: true, online: true, isNew: false, bio: 'Gamer', followers: 200 },
      { id: 332, name: 'Mia', avatar: '/images/avatar-mia.png', type: 'user', mutualFriends: 2, verified: false, online: true, isNew: true, bio: 'Fitness guru', followers: 180 },
    ]);
  }, []);

  // Filter & sort logic
  const filteredAndSorted = useMemo(() => {
    let arr = localUsers.filter(u =>
      u.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (u.bio && u.bio.toLowerCase().includes(filterText.toLowerCase()))
    );
    if (sortOption === 'mutual')      arr.sort((a,b)=> (b.mutualFriends||0)-(a.mutualFriends||0));
    else if (sortOption === 'followers') arr.sort((a,b)=> (b.followers||0)-(a.followers||0));
    else                              arr.sort((a,b)=> a.name.localeCompare(b.name));
    return arr.slice(0,20);
  }, [localUsers, filterText, sortOption]);

  if (!visible) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={handleShow}
          className="px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-colors duration-300 text-sm"
        >
          Show Recommended
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="recommended-container fixed bottom-0 left-0 right-0 p-4 shadow-t z-40" style={containerStyle}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between mb-2 space-x-2">
            <div className="flex space-x-2">
              <button onClick={handleHide} className={`${sharedButtonClass} text-xs`} title="Hide recommendations">
                Hide
              </button>
              <button onClick={handleSnooze} className={`${sharedButtonClass} text-xs`} title="Snooze 24HRS">
                <BellSlashIcon className="w-5 h-5" />
              </button>
              <button onClick={handleRefresh} className={`${sharedButtonClass} text-xs`} title="Refresh">
                <ArrowPathIcon className="w-5 h-5" />
              </button>
              <button onClick={()=>setAnimStyle(a=>a==='flip'?'fade':'flip')} className={`${sharedButtonClass} text-xs`} title="Toggle animation">
                <ArrowsUpDownIcon className="w-5 h-5" />
              </button>
              <button onClick={()=>setDetailedView(d=>!d)} className={`${sharedButtonClass} text-xs`} title="Toggle layout">
                <HandRaisedIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search users…"
                className="px-2 py-1 rounded border text-sm"
                value={filterText}
                onChange={e=>setFilterText(e.target.value)}
                style={{ background:'#fff', color:'#000' }}
              />
              <select
                value={sortOption}
                onChange={e=>setSortOption(e.target.value)}
                className="px-2 py-1 rounded border text-sm"
                style={{ background:'#fff', color:'#000' }}
              >
                <option value="name">Name</option>
                <option value="mutual">Mutual Friends</option>
                <option value="followers">Followers</option>
              </select>
            </div>
            <h2 className="text-2xl font-bold">
              <Link to="/recommended-users" className="hover:underline" style={{ color: containerStyle.color }}>
                Recommended
              </Link>
            </h2>
          </div>

          {/* Cards */}
          <motion.div
            className="flex gap-4 overflow-x-auto p-2 rounded-lg shadow border"
            style={{ backgroundColor: getScrollBoxBackground(theme) }}
          >
            {filteredAndSorted.map(u => (
              <motion.div
                key={u.id}
                className="flip-card relative min-w-[120px] cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={()=>{}}
              >
                {/* Front Face */}
                <motion.div
                  className="flip-card-inner"
                  whileHover={animStyle==='flip'?{ rotateY:180 }:{ opacity:0.8 }}
                  style={{ transformStyle:'preserve-3d', transition:'transform 0.6s' }}
                >
                  <div
                    className="flip-card-front relative flex flex-col items-center rounded-lg shadow p-2 overflow-hidden"
                    style={{ backfaceVisibility:'hidden', background:'#fff', color:'#000' }}
                  >
                    <button
                      onClick={e=>e.stopPropagation()}
                      className="absolute top-0 right-0 p-1"
                      title="Dismiss"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                    {u.type==='group' ? (
                      <UsersIcon className="w-12 h-12 mb-1" />
                    ) : u.type==='content' ? (
                      <DocumentTextIcon className="w-12 h-12 mb-1" />
                    ) : (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className={`w-12 h-12 mb-1 object-cover ${detailedView?'':'rounded-full'}`}
                        style={{ border: theme==='custom'?'4px solid #fff':'2px solid #999' }}
                      />
                    )}
                    <div className="flex items-center space-x-1">
                      <p className="text-xs font-semibold">{u.name}</p>
                      {u.verified && <CheckBadgeIcon className="w-4 h-4" />}
                    </div>
                    <div className="flex items-center mt-1">
                      <span className={`w-2 h-2 rounded-full ${u.online?'bg-green-500':'bg-gray-400'}`} />
                      <span className="ml-1 text-[10px]">{u.mutualFriends} mutual</span>
                    </div>
                    <div className="flex space-x-1 mt-2">
                      <button className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Follow</button>
                      <button className="px-2 py-1 text-xs bg-green-500 text-white rounded">
                        <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                      </button>
                      <button className="px-2 py-1 text-xs bg-yellow-500 text-white rounded">
                        <StarIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <button className="mt-1 px-2 py-1 text-xs bg-purple-500 text-white rounded">
                      <ArrowUpOnSquareIcon className="w-4 h-4" />
                    </button>
                    {u.isNew && <div className="mt-1 text-[10px] font-bold text-red-500">New</div>}
                  </div>
                  {/* Back Face */}
                  <div
                    className="flip-card-back absolute inset-0 flex flex-col items-center rounded-lg shadow p-2 overflow-hidden"
                    style={{ backfaceVisibility:'hidden', transform:'rotateY(180deg)', background:'#fff', color:'#000' }}
                  >
                    {/* same content as front or more details… */}
                    <button
                      onClick={e=>e.stopPropagation()}
                      className="absolute top-0 right-0 p-1"
                      title="Dismiss"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                    <p className="text-xs">More info here…</p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ARIA live */}
      <div className="sr-only" aria-live="assertive">{ariaMsg}</div>

      {/* Popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            className="fixed bottom-20 left-4 z-50 p-2 bg-black text-white rounded shadow-lg"
            variants={popupVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {popupMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
