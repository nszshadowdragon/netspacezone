// src/components/ContentSwitcher.jsx
import React, { memo } from 'react';
import PropTypes            from 'prop-types';
import { motion }           from 'framer-motion';
import LoadingSkeleton      from './LoadingSkeleton';

const bgForTheme = (theme) =>
  theme === 'custom'
    ? { backgroundColor: '#000000', color: '#ffffff' }
    : {};

function ContentSwitcher({
  showTrendingContent,
  trendingPosts = [],
  stories        = [],
  loading        = false,
  theme          = 'light',
  onExpandTrending,
  onExpandStory,
}) {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-6 mt-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mt-2 p-4 rounded-lg shadow-md border transition-colors duration-300"
        style={bgForTheme(theme)}
      >
        <div className="mb-4">
          <h3 className="title-box inline-block text-2xl font-bold">
            {showTrendingContent ? 'Showing Trending Posts' : 'Showing Stories'}
          </h3>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : showTrendingContent ? (
          /* ────────────── TRENDING POSTS ────────────── */
          <motion.div className="flex flex-nowrap gap-4 overflow-x-auto pr-2 border-t border-b py-2">
            {trendingPosts.slice(0, 20).map((post) => (
              <motion.div
                key={post.id}
                className="min-w-[200px] rounded-lg shadow p-4 cursor-pointer transition-colors duration-300"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300 }}
                onClick={() => onExpandTrending?.(post)}
                role="button"
                tabIndex={0}
                title={`View details for ${post.user}'s post`}
                style={bgForTheme(theme === 'custom' ? 'accent' : null)}
              >
                <h3 className="font-semibold text-sm mb-1">{post.user}</h3>
                <p className="text-xs mb-1">
                  {post.date ? new Date(post.date).toLocaleString() : 'No date'}
                </p>
                <p className="text-sm">{post.content}</p>
              </motion.div>
            ))}
            {trendingPosts.length > 20 && (
              <p className="text-xs italic">
                Showing only the top 20 trending posts.
              </p>
            )}
          </motion.div>
        ) : (
          /* ─────────────────── STORIES ─────────────────── */
          <motion.div className="flex flex-nowrap gap-4 overflow-x-auto pr-2 border-t border-b py-2">
            {stories.length ? (
              stories.slice(0, 20).map((story) => (
                <motion.div
                  key={story.id}
                  className="min-w-[200px] rounded-lg shadow p-4 cursor-pointer transition-colors duration-300"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  onClick={() => onExpandStory?.(story)}
                  role="button"
                  tabIndex={0}
                  title={`View story from ${story.user?.username || story.user?.name || 'User'}`}
                  style={bgForTheme(theme === 'custom' ? 'accent' : null)}
                >
                  <h3 className="font-semibold text-sm mb-1">
                    {story.user?.username || story.user?.name || 'User'} —{' '}
                    {story.date ? new Date(story.date).toLocaleString() : 'No date'}
                  </h3>

                  {story.videoUrl ? (
                    <video
                      src={story.videoUrl}
                      controls
                      className="w-full h-32 object-cover rounded"
                    />
                  ) : (
                    <p className="italic text-xs">No video attached</p>
                  )}
                </motion.div>
              ))
            ) : (
              <p className="text-xs italic">No stories available.</p>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

ContentSwitcher.propTypes = {
  showTrendingContent: PropTypes.bool.isRequired,
  trendingPosts:       PropTypes.array,
  stories:             PropTypes.array,
  loading:             PropTypes.bool,
  theme:               PropTypes.string,
  onExpandTrending:    PropTypes.func,
  onExpandStory:       PropTypes.func,
};

export default memo(ContentSwitcher);
