// src/pages/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Helmet } from 'react-helmet-async';
import { toast, ToastContainer } from 'react-toastify';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaTrophy, FaArrowUp as UpIcon } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import Navbar from '../components/Navbar';
import ThemeSelector from '../components/ThemeSelector';
import ChatWidget from '../components/ChatWidget';
import PostComposer from '../components/PostComposer';
import ActivityFeed from '../components/ActivityFeed';
import PostList from '../components/PostList';

import 'react-toastify/dist/ReactToastify.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export default function ProfilePage() {
  const [tab, setTab] = useState('profile');
  const [showComposer, setShowComposer] = useState(false);
  const [posts, setPosts] = useState([]);
  const [activities, setActivities] = useState([]);

  // Dummy user data
  const name = 'John Doe';
  const handle = '@johndoe';
  const avatar = '/profilepic.jpg';
  const bio = 'Passionate dev exploring the web.';
  const followers = 123;
  const following = 56;
  const verified = true;

  // Socket setup
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('initialPosts', setPosts);
    socket.on('initialActivities', setActivities);
    socket.on('newPost', p => {
      setPosts(prev => [p, ...prev]);
      toast.success('New post received!');
    });
    socket.on('newActivity', a => {
      setActivities(prev => [a, ...prev]);
      toast.info('New activity received!');
    });
    return () => socket.disconnect();
  }, []);

  const submitPost = newPost => {
    const socket = io(SOCKET_URL);
    socket.emit('createPost', newPost);
    setShowComposer(false);
  };

  return (
    <div className="flex flex-col min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Helmet>
        <title>{name} • NetSpace Zone</title>
        <meta name="description" content="Your profile on NetSpace Zone" />
      </Helmet>

      <Navbar user={{ fullName: name, profileImage: avatar }} />
      <ToastContainer />

      {/* Create Button */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 bg-teal-600 text-white p-4 rounded-full shadow-lg hover:bg-teal-700 transition"
        aria-label="New Post"
      >
        +
      </button>

      {showComposer && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowComposer(false)}
        >
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={e => e.stopPropagation()}
          >
            <PostComposer onSubmit={submitPost} />
            <button
              onClick={() => setShowComposer(false)}
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Main Content (edge‑to‑edge under this page’s control) */}
      <main className="pt-24 flex-1 w-full px-4 lg:px-6">
        {/* Header */}
        <motion.div
          className="sticky top-0 z-40 flex items-center justify-between bg-white/10 text-white p-6 rounded shadow-lg border-b border-white/20 backdrop-blur-sm mb-4 w-full"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="flex items-center space-x-4">
            <img src={avatar} alt={name} className="w-20 h-20 rounded-full border-4 border-white shadow" />
            <div>
              <h1 className="text-3xl font-bold">{name}</h1>
              <p className="text-lg">{handle.replace('@', '')}</p>
            </div>
          </div>
          <ThemeSelector />
        </motion.div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 w-full">
          {['profile', 'enhancements'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded ${
                tab === t ? 'bg-teal-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'profile' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <section className="space-y-6 w-full">
              {verified && (
                <div className="flex items-center space-x-2 text-green-600">
                  <FaCheckCircle size={20} /> <span>Verified User</span>
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-gray-800">About Me</h2>
                <p className="mt-1 text-gray-600">{bio}</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Your Posts</h2>
                <PostList posts={posts} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Photo Gallery</h2>
                <div className="grid grid-cols-2 gap-2">
                  {activities.slice(0, 4).map((a, i) => (
                    <img key={i} src={a.photoUrl} alt="" className="w-full h-auto rounded shadow-sm" />
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-6 w-full">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Social Links</h2>
                <div className="flex space-x-4 text-gray-600">
                  {/* insert your social icons here */}
                </div>
              </div>
              <div className="bg-white rounded shadow p-4 text-center w-full">
                <p className="text-2xl font-bold text-gray-800">{followers}</p>
                <p className="text-gray-500">Followers</p>
                <p className="mt-4 text-2xl font-bold text-gray-800">{following}</p>
                <p className="text-gray-500">Following</p>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Achievements</h2>
                <div className="flex space-x-4 text-yellow-500">
                  <FaCheckCircle size={28} />
                  <FaTrophy size={28} />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Activity Feed</h2>
                <ActivityFeed activities={activities} />
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="p-4 bg-white rounded shadow">Enhancement 1</div>
            <div className="p-4 bg-white rounded shadow">Enhancement 2</div>
          </div>
        )}
      </main>

      <ChatWidget />

      {/* Scroll-to-top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 bg-blue-500 text-white p-3 rounded-full shadow hover:bg-blue-600 transition"
        aria-label="Scroll to top"
      >
        <UpIcon />
      </button>
    </div>
  );
}
