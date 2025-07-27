import React from 'react';
export default function FollowerFollowing({
  followersCount = 0,
  followingCount = 0,
  theme,
}) {
  return (
    <div className="p-4 mb-6 rounded bg-white/20 backdrop-blur-sm">
      <h3 className="font-bold mb-2">Connections (stub)</h3>
      <p>Followers: {followersCount}</p>
      <p>Following: {followingCount}</p>
    </div>
  );
}
