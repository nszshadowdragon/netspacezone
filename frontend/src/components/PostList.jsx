import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FixedSizeList as List } from 'react-window';
import debounce from 'lodash.debounce';
import LoadingSkeleton from './LoadingSkeleton';
import { Poll } from './Poll'; // Import Poll from your separate Poll.jsx

// Helper function to truncate text if it's too long
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Helper function to format countdown for post expiration
function formatCountdown(diff) {
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return `${hours}h ${minutes}m ${seconds}s`;
}

// A single PostCard component for each post
function PostCard({
  post,
  currentUser,
  onVote,     // <--- Passed down to handle poll voting
  onEdit,     // <--- If you want an explicit edit button
  onLike,
  onFollow,
  onShare,
  onComment
}) {
  // Expand/collapse content
  const [isExpanded, setIsExpanded] = useState(false);
  // Like state
  const [liked, setLiked] = useState(post.liked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  // Comment input toggle
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  // Lightbox for media
  const [showLightbox, setShowLightbox] = useState(false);
  // Show/hide a share modal (dummy)
  const [showShareModal, setShowShareModal] = useState(false);

  // Toggle like (local + callback)
  const handleToggleLike = () => {
    const newLiked = !liked;
    setLiked(newLiked);
    const newCount = newLiked ? likesCount + 1 : Math.max(likesCount - 1, 0);
    setLikesCount(newCount);
    // Call parent’s onLike if needed
    if (onLike) onLike(post.id, newLiked);
  };

  // Add comment
  const handleAddComment = () => {
    if (commentText.trim()) {
      const newComments = [...comments, commentText.trim()];
      setComments(newComments);
      setCommentText('');
      setShowCommentInput(false);
      // Pass updated comments up
      if (onComment) onComment(post.id, newComments);
    }
  };

  // Show full or truncated content
  const contentToShow = isExpanded ? post.content : truncateText(post.content, 100);

  // Handle expiration text
  let expirationText = "";
  if (post.advanced && post.advanced.postExpiration) {
    const diff = new Date(post.advanced.postExpiration) - new Date();
    expirationText = formatCountdown(diff);
  }

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-xl transition-shadow"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Post Header */}
      <div className="flex items-center space-x-3 mb-2">
        <img
          src={post.avatar || '/images/default-avatar.png'}
          alt={post.user}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">{post.user}</p>
          <p className="text-xs text-gray-500">
            {new Date(post.date).toLocaleString('default', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {/* If current user is the author, show an Edit button */}
        {post.user === currentUser && onEdit && (
          <button
            onClick={() => onEdit(post)}
            className="ml-auto text-sm text-blue-500 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {/* Post Content */}
      <p className="text-gray-800 dark:text-gray-200">{contentToShow}</p>
      {post.content.length > 100 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1 text-sm text-blue-500 hover:underline"
        >
          {isExpanded ? 'Show Less' : 'Read More'}
        </button>
      )}
      {expirationText && (
        <p className="mt-1 text-xs text-red-500 font-bold">
          Expires in {expirationText}
        </p>
      )}

      {/* Post Media (if any) */}
      {post.media && (
        <div className="mt-2">
          <img
            src={post.media}
            alt="Post media"
            className="w-full rounded cursor-pointer"
            loading="lazy"
            onClick={() => setShowLightbox(true)}
          />
          <AnimatePresence>
            {showLightbox && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLightbox(false)}
              >
                <motion.img
                  src={post.media}
                  alt="Large post media"
                  className="max-w-3xl rounded"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Post Actions */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex space-x-4">
          {/* Like */}
          <button
            onClick={handleToggleLike}
            className="flex items-center space-x-1 text-blue-500 hover:underline text-sm"
          >
            <motion.span
              whileTap={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {liked ? '❤️' : '🤍'}
            </motion.span>
            <span>{likesCount}</span>
          </button>
          {/* Comment */}
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            className="flex items-center space-x-1 text-blue-500 hover:underline text-sm"
          >
            <span>💬</span>
            <span>{comments.length}</span>
          </button>
          {/* Share */}
          <button
            onClick={() => setShowShareModal(true)}
            className="text-blue-500 hover:underline text-sm"
          >
            Share
          </button>
        </div>
        <div>
          {/* Save/Unsave (dummy) */}
          <button className="text-sm text-green-500 hover:underline">
            {post.saved ? 'Unsave' : 'Save'}
          </button>
        </div>
      </div>

      {/* Inline Comment Input */}
      {showCommentInput && (
        <div className="mt-2">
          <input
            type="text"
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <button
            onClick={handleAddComment}
            className="mt-1 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Submit
          </button>
        </div>
      )}

      {/* Poll (if advanced.poll exists) */}
      {post.advanced?.poll && (
        <div className="mt-3">
          <Poll
            poll={post.advanced.poll}
            onVote={(optionIndex) => {
              if (onVote) onVote(post.id, optionIndex);
            }}
          />
        </div>
      )}

      {/* Share Modal (dummy) */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-4">Share Post</h3>
              <div className="space-y-2">
                <button className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                  Copy Link
                </button>
                <button className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
                  Share on Social
                </button>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="mt-4 w-full py-2 bg-gray-200 text-black rounded hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Main PostList component
export default function PostList({ currentUser = '@Alice' }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const feedContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const debouncedSearch = useCallback(debounce((query) => setSearchQuery(query), 300), []);
  const handleSearchChange = (e) => {
    debouncedSearch(e.target.value);
  };

  // Example: Initialize post with interactive fields
  const initializePost = (post) => ({
    ...post,
    liked: false,
    likes: post.likes || 0,
    followed: false,
    shareCount: 0,
    commentCount: 0,
    saved: false,
  });

  // Load initial posts (simulate)
  useEffect(() => {
    setTimeout(() => {
      const initialPosts = [
        initializePost({
          id: 1,
          user: currentUser,
          content:
            'Loving this new platform! 🎉 This is my status update with some extra text to make it longer.',
          date: new Date(),
          likes: 5,
          advanced: { postExpiration: new Date(Date.now() + 3600000) },
        }),
        initializePost({
          id: 2,
          user: '@Bob',
          content: 'Check out my new blog post! ✍️',
          date: new Date(),
          likes: 2,
          advanced: {},
        }),
      ];
      setPosts(initialPosts);
      setLoading(false);
    }, 1500);
  }, [currentUser]);

  // Infinite scrolling
  const fetchMorePosts = useCallback(() => {
    setPage((prev) => {
      const nextPage = prev + 1;
      setLoading(true);
      setTimeout(() => {
        const newPosts = [
          initializePost({
            id: Date.now(),
            user: '@Charlie',
            content: 'Another exciting update! 🚀',
            date: new Date(),
            likes: 0,
            advanced: {},
          }),
          initializePost({
            id: Date.now() + 1,
            user: '@Dana',
            content: 'Loving the community vibe! 😊',
            date: new Date(),
            likes: 0,
            advanced: {},
          }),
        ];
        setPosts((prevPosts) => [...prevPosts, ...newPosts]);
        setLoading(false);
        if (nextPage >= 3) setHasMore(false);
      }, 1500);
      return nextPage;
    });
  }, []);

  useEffect(() => {
    if (!hasMore || !feedContainerRef.current || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchMorePosts();
      },
      { root: feedContainerRef.current, rootMargin: '0px', threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, fetchMorePosts]);

  useEffect(() => {
    const container = feedContainerRef.current;
    if (!container) return;
    const handleScroll = () => setShowBackToTop(container.scrollTop > 200);
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtering and sorting
  const nowTime = Date.now();
  const filteredPosts = posts.filter((post) =>
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const sortedFilteredPosts =
    sortOption === 'newest'
      ? [...filteredPosts].sort((a, b) => new Date(b.date) - new Date(a.date))
      : [...filteredPosts]
          .filter((post) => new Date(post.date).getTime() >= nowTime - 24 * 60 * 60 * 1000)
          .sort((a, b) => (b.likes || 0) - (a.likes || 0));

  // Handler for poll voting
  const handleVote = (postId, optionIndex) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId && post.advanced && post.advanced.poll) {
          const poll = post.advanced.poll;
          const currentVote = poll.userVote;
          const newVotes = [...poll.votes];
          if (currentVote === null) {
            newVotes[optionIndex] += 1;
            poll.userVote = optionIndex;
          } else if (currentVote === optionIndex) {
            newVotes[currentVote] = Math.max(newVotes[currentVote] - 1, 0);
            poll.userVote = null;
          } else {
            newVotes[currentVote] = Math.max(newVotes[currentVote] - 1, 0);
            newVotes[optionIndex] += 1;
            poll.userVote = optionIndex;
          }
          return {
            ...post,
            advanced: { ...post.advanced, poll: { ...poll, votes: newVotes } },
          };
        }
        return post;
      })
    );
  };

  return (
    <div className="p-4">
      {/* Search + Sort */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Search posts..."
          onChange={handleSearchChange}
          className="py-1 px-2 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
        />
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="py-1 px-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="popular">Popular</option>
        </select>
      </div>

      {/* Feed Container */}
      <div ref={feedContainerRef} className="max-h-[600px] overflow-y-auto space-y-4">
        {loading && posts.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* If you have more than 20 posts, optionally use react-window */}
            {sortedFilteredPosts.length > 20 ? (
              <List
                height={600}
                itemCount={sortedFilteredPosts.length}
                itemSize={150}
                width="100%"
              >
                {({ index, style }) => {
                  const post = sortedFilteredPosts[index];
                  return (
                    <div style={style}>
                      <PostCard
                        post={post}
                        currentUser={currentUser}
                        onVote={handleVote}
                        // onEdit, onLike, onFollow, onShare, etc. can be passed similarly
                      />
                    </div>
                  );
                }}
              </List>
            ) : (
              sortedFilteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onVote={handleVote}
                  // onEdit, onLike, onFollow, onShare, etc.
                />
              ))
            )}
            {hasMore && (
              <div className="text-center mt-4" ref={sentinelRef}>
                <button
                  onClick={fetchMorePosts}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded hover:from-teal-600 hover:to-teal-700 transition-colors duration-300"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Back to Top */}
      {showBackToTop && (
        <div className="text-right mt-2">
          <button
            onClick={() =>
              feedContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
            }
            className="px-3 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded hover:from-teal-600 hover:to-teal-700 transition-colors duration-300"
          >
            Back to Top
          </button>
        </div>
      )}
    </div>
  );
}
