import React from 'react';
import { useParams } from "react-router-dom";
import PostComposer from './PostComposer';
import PostList from './PostList';
import ImageGallery from './ImageGallery';
import ActivityFeed from './ActivityFeed';

export default function ProfileFeedSection({
  user,
  cardStyle,
  sectionTitle,
  showComposer,
  setShowComposer,
  handleCreatePost,
  posts,
  activities,
}) {
  const { username } = useParams();

  return (
    <div style={{ flex: '2 1 60%', minWidth: 0 }}>
      {/* Post Composer Section */}
      <div style={cardStyle}>
        <button
          onClick={() => setShowComposer(true)}
          style={{
            padding: '0.7rem 1.8rem',
            background: '#facc15',
            color: '#000',
            border: 'none',
            borderRadius: '7px',
            fontWeight: 800,
            fontSize: '1.1rem',
            cursor: 'pointer',
            letterSpacing: 1,
            boxShadow: '0 2px 10px #0004',
            marginBottom: '0.5rem'
          }}
        >
          New Post
        </button>
        {showComposer && (
          <PostComposer
            onSubmit={handleCreatePost}
            onCancel={() => setShowComposer(false)}
            currentUser={user}
          />
        )}
      </div>

      {/* Post Feed */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Your Posts</h2>
        <PostList
          key={
            username ||
            (user && user._id) ||
            (posts && posts.length && (posts[0]._id || posts[0].id)) ||
            Math.random()
          }
          posts={posts}
          currentUser={user}
        />
      </div>

      {/* Image Gallery */}
      <ImageGallery user={user} />

      {/* Activity Timeline */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Activity Timeline</h2>
        {activities.length > 0 ? (
          <ActivityFeed activities={activities} />
        ) : (
          <p style={{ color: '#b7b378' }}>No recent activity.</p>
        )}
      </div>
    </div>
  );
}
