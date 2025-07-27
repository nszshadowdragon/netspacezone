import React, { useState } from 'react';

export default function PostComposer({ onPost }) {
  const [postContent, setPostContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    if (typeof onPost === 'function') {
      onPost(postContent);
    } else {
      console.error('onPost is not a function');
    }

    setPostContent('');
  };

  return (
    <div className="bg-white p-4 shadow-md rounded-md">
      <form onSubmit={handleSubmit}>
        <textarea
          className="w-full border p-2 rounded-md"
          placeholder="What's on your mind?"
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
        />
        <button
          type="submit"
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md"
        >
          Post
        </button>
      </form>
    </div>
  );
}
