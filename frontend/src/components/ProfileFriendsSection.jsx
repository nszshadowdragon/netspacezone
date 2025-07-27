import React from 'react';

export default function ProfileFriendsSection({
  user,
  cardStyle,
  sectionTitle,
  showMoreFriends,
  setShowMoreFriends,
  showFriendsPopup,
  setShowFriendsPopup,
  showEditTopFriends,
  setShowEditTopFriends,
  topFriends,
  setEditSelection,
  followers,
  following,
  showFollowersPopup,
  setShowFollowersPopup,
  showFollowingPopup,
  setShowFollowingPopup,
  myUserId,
}) {
  function getTopFriendsArray() {
    if (!user || !user.friends) return [];
    if (!topFriends || !topFriends.length || user.friends.length <= 8) {
      return user.friends || [];
    }
    return topFriends
      .map(id => (user.friends || []).find(f => (f._id || f.id) === id))
      .filter(Boolean);
  }

  function renderFriendsAvatars(friendsArr) {
    return (friendsArr || []).map(friend => (
      <a
        key={friend._id}
        href={`/profile/${friend.username}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textDecoration: 'none',
          color: '#ffe066',
          minWidth: 95
        }}
      >
        <img
          src={
            friend.profileImage
              ? (friend.profileImage.startsWith('http')
                ? friend.profileImage
                : `http://localhost:5000${friend.profileImage}`)
              : `https://ui-avatars.com/api/?name=${friend.username || "U"}`
          }
          alt={friend.username}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid #facc15",
            marginBottom: 6,
            background: "#181818"
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 16, color: "#ffe066", textAlign: 'center' }}>
          {friend.fullName || friend.username}
        </span>
      </a>
    ));
  }

  if (!user) return null;
  const friendsArr = user.friends || [];
  const topFriendsArr = getTopFriendsArray();
  const showEdit = (user._id === myUserId) && friendsArr.length > 8;
  const showViewMore = friendsArr.length > 8;

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',       // NEW: wrap on overflow
          minWidth: 0,            // NEW: prevent overflow
          maxWidth: '100%',       // NEW: prevent overflow
          boxSizing: 'border-box' // Defensive
        }}
      >
        <h2 style={sectionTitle}>
          {user._id === myUserId ? "Your Top Friends" : `${user.fullName || user.username}'s Top Friends`}
        </h2>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',      // NEW: wrap buttons on overflow
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <button
            style={{
              background: '#ffe066', color: '#23273a', border: 'none', borderRadius: 7,
              fontWeight: 700, fontSize: 16, padding: '7px 16px', cursor: 'pointer',
              maxWidth: '100%' // NEW: never overflow
            }}
            onClick={() => setShowFriendsPopup(true)}
          >Friends ({friendsArr.length})</button>
          {showEdit && (
            <button
              style={{
                background: '#23273a', color: '#ffe066', border: '1.5px solid #ffe066', borderRadius: 7,
                fontWeight: 700, fontSize: 16, padding: '7px 16px', cursor: 'pointer',
                maxWidth: '100%' // NEW: never overflow
              }}
              onClick={() => { setEditSelection(topFriends); setShowEditTopFriends(true); }}
            >Edit Top Friends</button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, marginTop: 16 }}>
        {renderFriendsAvatars(showMoreFriends ? friendsArr : topFriendsArr.slice(0, 8))}
      </div>
      {showViewMore && (
        <button
          style={{
            background: '#23273a', color: '#ffe066', border: '1.5px solid #ffe066', borderRadius: 7,
            fontWeight: 700, fontSize: 16, padding: '7px 22px', marginTop: 16, cursor: 'pointer'
          }}
          onClick={() => setShowMoreFriends(v => !v)}
        >
          {showMoreFriends ? "View Less" : "View More"}
        </button>
      )}
      <div style={{ marginTop: 26, display: "flex", gap: 18, alignItems: "center", flexWrap: 'wrap', minWidth: 0 }}>
        <button
          style={{
            background: '#23273a',
            color: '#ffe066',
            border: '1.5px solid #ffe066',
            borderRadius: 7,
            fontWeight: 700,
            fontSize: 16,
            padding: '7px 16px',
            cursor: 'pointer',
            maxWidth: '100%'
          }}
          onClick={() => setShowFollowersPopup(true)}
        >
          Followers ({followers.length})
        </button>
        <button
          style={{
            background: '#23273a',
            color: '#ffe066',
            border: '1.5px solid #ffe066',
            borderRadius: 7,
            fontWeight: 700,
            fontSize: 16,
            padding: '7px 16px',
            cursor: 'pointer',
            maxWidth: '100%'
          }}
          onClick={() => setShowFollowingPopup(true)}
        >
          Following ({following.length})
        </button>
      </div>
    </div>
  );
}
