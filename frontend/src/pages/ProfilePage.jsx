// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';

import Navbar           from '../components/Navbar';
import themeSelector    from '../components/themeSelector';
import AboutMe          from '../components/AboutMe';
import UserPostFeed     from '../components/UserPostFeed';
import Achievements     from '../components/Achievements';
import RecommendedUsers from '../components/RecommendedUsers';
import LazyChatWidget   from '../components/ChatWidget';

import {
  UserPlusIcon,
  StarIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowUpOnSquareIcon,
  XMarkIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { theme: globalTheme } = useTheme();
  const { user: me, updateUser } = useAuth();
  const { username: paramUsername } = useParams();

  const [profileUser, setProfileUser] = useState(null);
  const [topFriends,  setTopFriends]  = useState([]);
  const [isFriend,    setIsFriend]    = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [showRecommended, setShowRecommended] = useState(true);

  /* ─────────── Fetch profile ─────────── */
  useEffect(() => {
    const who = paramUsername || me.username;
    if (!who) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('[Profile] No auth token');
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    api.get(`/users/${who}`)
      .then(({ data: u }) => {
        setProfileUser(u);
        const friends = Array.isArray(u.friends) ? u.friends : [];
        setTopFriends(friends.slice(0, 10));
        setIsFriend(friends.some(f => f.username === me.username));
        setIsFollowing(Array.isArray(u.followers) && u.followers.includes(me.username));
      })
      .catch(err => console.error('[Profile] Load profile error', err));
  }, [paramUsername, me]);

  /* ─────── Check outgoing requests ─────── */
  useEffect(() => {
    const who = paramUsername || me.username;
    if (!who) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    api.get('/friend-requests/outgoing')
       .then(({ data }) => setRequestSent(data.some(fr => fr.to.username === who)))
       .catch(() => {/* silent */});
  }, [paramUsername, me]);

  if (!profileUser) {
    return <div className="mt-32 text-center">Loading…</div>;
  }

  const {
    fullName,
    username: uname,
    profilePic,
    avatarUrl,
    bio,
    posts = [],
    recommended = []
  } = profileUser;

  const name   = fullName || uname || 'Guest';
  const handle = `@${uname}`;
  const avatar = profilePic || avatarUrl || '/temp-avatar.png';
  const isOwn  = uname === me.username;

  const containerClass =
    globalTheme === 'light'
      ? 'bg-white text-gray-900'
      : globalTheme === 'dark'
      ? 'bg-gray-900 text-gray-50'
      : 'bg-gradient-to-r from-red-900 to-purple-900 text-gray-50';

  /* ───────── Friend actions ───────── */
  const handleAddFriend = async () => {
    try {
      if (isFriend) {
        await api.post(`/users/${uname}/unfriend`);
        setIsFriend(false);
        setTopFriends(tf => tf.filter(f => f.username !== uname));
        setProfileUser(u => ({ ...u, friends: u.friends.filter(f => f.username !== uname) }));
        console.info('[Profile] Unfriended');
      } else if (requestSent) {
        await api.delete(`/users/${uname}/friend-request`);
        setRequestSent(false);
        console.info('[Profile] Request cancelled');
      } else {
        await api.post(`/users/${uname}/friend-request`);
        setRequestSent(true);
        console.info('[Profile] Request sent');
      }
    } catch (err) {
      console.error('[Profile] Friend request error', err);
    }
  };

  /* ───────── Follow actions ───────── */
  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.post(`/users/${uname}/unfollow`);
        setIsFollowing(false);
        console.info('[Profile] Unfollowed');
      } else {
        await api.post(`/users/${uname}/follow`);
        setIsFollowing(true);
        console.info('[Profile] Now following');
      }
    } catch (err) {
      console.error('[Profile] Follow error', err);
    }
  };

  const handleMessage = () => console.log(`[Profile] Message ${handle}`);
  const handleShare   = () => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${uname}`);
    console.log('[Profile] Link copied');
  };

  /* ───────── Bio save ───────── */
  const handleBioSave = async newBio => {
    if (!isOwn) return;
    try {
      const { data: updated } = await api.put('/me', { bio: newBio });
      updateUser({ bio: updated.bio });
      setProfileUser(p => ({ ...p, bio: updated.bio }));
      console.info('[Profile] Bio updated');
    } catch (err) {
      console.error('[Profile] Save bio error', err);
    }
  };

  /* ───────── Friend‐card helpers ───────── */
  const handleFollowFriend = friendUsername =>
    console.log(`[Profile] Follow/unfollow ${friendUsername}`);
  const handleMessageUser  = friendUsername =>
    console.log(`[Profile] Message ${friendUsername}`);
  const handleShareUser    = friendUsername => {
    navigator.clipboard.writeText(`${window.location.origin}/profile/${friendUsername}`);
    console.log('[Profile] Friend link copied');
  };

  /* ──────────────────────────────────── JSX ───────────────────────── */
  return (
    <div className={`${containerClass} flex flex-col min-h-screen`}>
      <Navbar />

      <div className="mt-20 flex-1 overflow-auto px-4 lg:px-6 pb-8">
        <Helmet><title>{name} — NetSpace Zone</title></Helmet>

        {/* HEADER */}
        <motion.div
          className="flex items-center bg-white/10 text-white p-6 rounded shadow-lg border-b-4 border-white/20 backdrop-blur-sm"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <img src={avatar} alt={name} className="w-20 h-20 rounded-full border-2 border-white object-cover" />
          <div className="ml-4 flex-1">
            <h1 className="text-3xl font-extrabold">{name}</h1>
            <p className="text-xl">{handle}</p>
            {!isOwn && (
              <div className="mt-4 flex space-x-3">
                <button onClick={handleAddFriend} className="flex items-center space-x-1 px-3 py-1 bg-teal-500 rounded hover:bg-teal-600">
                  <UserPlusIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-sm">
                    {isFriend ? 'Unfriend' : requestSent ? 'Cancel Request' : 'Add'}
                  </span>
                </button>
                <button onClick={handleFollow} className="flex items-center space-x-1 px-3 py-1 bg-purple-500 rounded hover:bg-purple-600">
                  <StarIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-sm">
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </span>
                </button>
                <button onClick={handleMessage} className="flex items-center space-x-1 px-3 py-1 bg-blue-500 rounded hover:bg-blue-600">
                  <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-sm">Message</span>
                </button>
                <button onClick={handleShare} className="flex items-center space-x-1 px-3 py-1 bg-gray-500 rounded hover:bg-gray-600">
                  <ArrowUpOnSquareIcon className="w-5 h-5 text-white" />
                  <span className="text-white text-sm">Share</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* THE REST OF THE PAGE (themeSelector, AboutMe, Friends, Posts, etc.) */}
        {/* … unchanged content … */}

        <LazyChatWidget />
      </div>
    </div>
  );
}