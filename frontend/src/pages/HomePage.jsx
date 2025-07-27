// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import io from 'socket.io-client';
import { motion } from 'framer-motion';

import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';

import Navbar            from '../components/Navbar';
import themeSelector     from '../components/themeSelector';
import TopNavigation     from '../components/TopNavigation';
import ContentSwitcher   from '../components/ContentSwitcher';
import RecommendedUsers  from '../components/RecommendedUsers';
import postLiveFeed      from '../components/postLiveFeed';
import ActivityFeed      from '../components/ActivityFeed';
import LazyChatWidget    from '../components/ChatWidget';
import ErrorBoundary     from '../components/ErrorBoundary';
import StoryModal        from '../components/StoryModal';
import CreateStatusModal from '../components/CreateStatusModal';

/* shared utility ------------------------------------------------ */
const sharedButtonClass =
  'px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 ' +
  'hover:from-teal-600 hover:to-teal-700 transition-colors duration-300';

// pick up chat server from env (or default to same origin)
const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER || window.location.origin;

export default function HomePage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { theme }  = useTheme();
  const { user, setUser } = useAuth();

  // theme-aware container
  const containerClass =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : theme === 'dark'
      ? 'bg-gray-900 text-gray-50'
      : 'bg-gradient-to-r from-red-900 to-purple-900 text-gray-50';

  /* hydrate user after landing/login */
  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      localStorage.setItem('nsz_user', JSON.stringify(location.state.user));
    }
  }, [location.state, setUser]);

  /* placeholder/demo state */
  const [trendingPosts,      setTrendingPosts]       = useState([]);
  const [stories,            setStories]             = useState([]);
  const [recommendedUsers,   setRecommendedUsers]    = useState([]);
  const [showRecommended,    setShowRecommended]     = useState(true);
  const [showTrendingContent,setShowTrendingContent] = useState(true);
  const [loading,            setLoading]             = useState(true);

  const [showStatusModal,    setShowStatusModal]     = useState(false);
  const [showStoryModal,     setShowStoryModal]      = useState(false);

  /* mock data fetches */
  useEffect(() => {
    const t1 = setTimeout(() => {
      setTrendingPosts([
        { id: 101, user: 'Eve',   content: 'Trending 1...', date: new Date() },
        { id: 102, user: 'Frank', content: 'Trending 2...', date: new Date() },
      ]);
    }, 1500);

    const t2 = setTimeout(() => {
      setStories([{ id: 201, title: 'Story 1', description: 'Content...', date: new Date(), user }]);
      setLoading(false);
    }, 2000);

    const t3 = setTimeout(() => {
      setRecommendedUsers([{ id: 301, name: 'Harold', avatar: '/images/avatar-harold.png', bio: 'Loves hiking' }]);
    }, 2500);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [user]);

  /* snooze for RecommendedUsers */
  useEffect(() => {
    const snoozedUntil = localStorage.getItem('recommendedSnoozedUntil');
    setShowRecommended(!(snoozedUntil && Date.now() < +snoozedUntil));
  }, []);

  /* chat socket */
  useEffect(() => {
    const socket = io(CHAT_SERVER, { transports: ['websocket'] });
    socket.on('connect_error', err => {
      console.error('Socket connection error:', err.message);
    });
    socket.on('newMessage', () => {});
    return () => socket.disconnect();
  }, []);

  /* content toggles */
  const handleSwitchToTrending = () =>
    showTrendingContent ? navigate('/trending') : setShowTrendingContent(true);
  const handleSwitchToStories = () =>
    !showTrendingContent ? navigate('/stories') : setShowTrendingContent(false);

  /* modal commit */
  const handleStatusCommit = data => {
    console.log('Status:', data);
    setShowStatusModal(false);
  };
  const handleStoryCommit = data => {
    const newStory = { ...data, id: Date.now(), user, date: new Date() };
    setStories(prev => [newStory, ...prev]);
    setShowStoryModal(false);
    console.log('Story:', newStory);
  };

  return (
    <ErrorBoundary>
      <div className={`${containerClass} flex flex-col min-h-screen`}>
        <Navbar />

        <div className="mt-20 flex-1 overflow-auto px-2 lg:px-6 pb-8">
          <Helmet>
            <title>Home — NetSpace Zone</title>
            <meta name="description" content="Your personalized NSZ home." />
          </Helmet>

          <themeSelector />

          <TopNavigation
            showTrendingContent={showTrendingContent}
            onSwitchContent={section =>
              section === 'trending' ? handleSwitchToTrending() : handleSwitchToStories()
            }
          />

          <ContentSwitcher
            showTrendingContent={showTrendingContent}
            trendingPosts={trendingPosts}
            stories={stories}
            loading={loading}
            theme={theme}
            onExpandTrending={post => console.log('Expand', post)}
            onExpandStory={story => console.log('Expand', story)}
          />

          <div className="flex justify-center space-x-4 my-4">
            <button className={sharedButtonClass} onClick={() => setShowStatusModal(true)}>Create Status</button>
            <button className={sharedButtonClass} onClick={() => navigate('/livestream')}>NSZ Live</button>
            <button className={sharedButtonClass} onClick={() => setShowStoryModal(true)}>Story</button>
          </div>

          <CreateStatusModal show={showStatusModal} onCancel={() => setShowStatusModal(false)} onCommit={handleStatusCommit} />
          <StoryModal        show={showStoryModal}  onCancel={() => setShowStoryModal(false)}  onCommit={handleStoryCommit} />

          <div className="w-full max-w-7xl mx-auto p-2 lg:p-4 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 rounded-lg shadow-md p-4 border bg-white">
              <h2 className="text-xl font-bold border-b pb-2 mb-2">Post Feed</h2>
              <postLiveFeed />
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full md:w-[35%] rounded-lg shadow-md p-4 border bg-white"
            >
              <h2 className="text-xl font-bold border-b pb-2 mb-2">Activity Feed</h2>
              <ActivityFeed />
            </motion.div>
          </div>

          {showRecommended ? (
            <RecommendedUsers recommendedUsers={recommendedUsers} onHide={() => setShowRecommended(false)} />
          ) : (
            <div className="fixed bottom-4 left-4 z-50">
              <button
                onClick={() => setShowRecommended(true)}
                className="px-4 py-2 rounded text-white bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 transition-colors duration-300 text-sm"
              >
                Show Recommended
              </button>
            </div>
          )}

          <LazyChatWidget />
        </div>
      </div>
    </ErrorBoundary>
  );
}
