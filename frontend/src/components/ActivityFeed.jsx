import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

const ActivityFeed = () => {
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState('all');
  const feedRef = useRef(null);

  // Initial dummy activities load
  useEffect(() => {
    const initialActivities = [
      { id: 1, type: 'like', message: 'Alice liked your post', timestamp: new Date() },
      { id: 2, type: 'comment', message: 'Bob commented on your post', timestamp: new Date() },
      { id: 3, type: 'follow', message: 'Charlie started following you', timestamp: new Date() }
    ];
    setActivities(initialActivities);
  }, []);

  // Simulate receiving a new activity every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const newActivity = {
        id: Date.now(),
        type: 'like',
        message: `User${Date.now()} liked your post`,
        timestamp: new Date()
      };
      setActivities(prev => [newActivity, ...prev]);
      toast.info('New activity received!');
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter activities based on the selected filter
  const filteredActivities =
    filter === 'all' ? activities : activities.filter(activity => activity.type === filter);

  return (
    <div ref={feedRef} className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Activity Feed</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded p-1"
          aria-label="Filter activities"
        >
          <option value="all">All</option>
          <option value="like">Likes</option>
          <option value="comment">Comments</option>
          <option value="follow">Follows</option>
        </select>
      </div>
      <AnimatePresence>
        {filteredActivities.map(activity => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className="p-2 border-b border-gray-200"
          >
            <p className="text-sm">{activity.message}</p>
            <p className="text-xs text-gray-500">
              {activity.timestamp.toLocaleTimeString()}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ActivityFeed;
