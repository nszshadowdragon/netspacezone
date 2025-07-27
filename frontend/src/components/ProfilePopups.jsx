import React from 'react';
import FriendsPopup from './FriendsPopup';
import FollowersPopup from './FollowersPopup';

export default function ProfilePopups({
  showFriendsPopup,
  setShowFriendsPopup,
  showEditTopFriends,
  setShowEditTopFriends,
  editSelection,
  setEditSelection,
  user,
  myUserId,
  topFriends,
  setTopFriends,
  showFollowersPopup,
  setShowFollowersPopup,
  showFollowingPopup,
  setShowFollowingPopup,
  followers,
  following,
}) {
  return (
    <>
      {showFriendsPopup && (
        <FriendsPopup
          friends={user?.friends || []}
          topFriends={topFriends}
          isEditing={showEditTopFriends}
          editSelection={editSelection}
          setEditSelection={setEditSelection}
          myUserId={myUserId}
          isOwnProfile={user && user._id === myUserId}
          onClose={() => { setShowFriendsPopup(false); setShowEditTopFriends(false); }}
          onEditTopFriendsSave={async newTopFriends => {
            try {
              const token = localStorage.getItem('token');
              const res = await fetch('http://localhost:5000/api/social/top-friends', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ topFriends: newTopFriends }),
              });
              if (res.ok) {
                setTopFriends(newTopFriends);
              } else {
                // Optionally, toast an error here
              }
            } catch {
              // Optionally, toast an error here
            }
            setShowEditTopFriends(false);
          }}
        />
      )}
      {showFollowersPopup && (
        <FollowersPopup
          title="Followers"
          users={followers}
          onClose={() => setShowFollowersPopup(false)}
        />
      )}
      {showFollowingPopup && (
        <FollowersPopup
          title="Following"
          users={following}
          onClose={() => setShowFollowingPopup(false)}
        />
      )}
    </>
  );
}
