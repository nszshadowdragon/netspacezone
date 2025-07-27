import React, { useState } from 'react';

export default function FriendsPopup({
  friends = [],
  topFriends = [],
  isEditing = false,
  editSelection = [],
  setEditSelection = () => {},
  myUserId,
  isOwnProfile,
  onClose,
  onEditTopFriendsSave = () => {}
}) {
  const [editMode, setEditMode] = useState(isEditing);
  const [tempSelection, setTempSelection] = useState(editSelection);

  // Auto close edit if less than or equal to 8 friends
  React.useEffect(() => {
    if (friends.length <= 8) {
      setEditMode(false);
    }
  }, [friends.length]);

  // Returns the "displayed" friends in order for top 8
  function getTopFriendsArray() {
    if (friends.length <= 8 || (!topFriends || !topFriends.length)) {
      return friends;
    }
    return topFriends
      .map(id => friends.find(f => (f._id || f.id) === id))
      .filter(Boolean);
  }

  // Handler: select/deselect in edit mode
  function handleToggleFriend(friendId) {
    let selection = [...tempSelection];
    if (selection.includes(friendId)) {
      selection = selection.filter(id => id !== friendId);
    } else if (selection.length < 8) {
      selection.push(friendId);
    }
    setTempSelection(selection);
  }

  // Handler: move friend in edit selection
  function moveSelection(index, direction) {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === tempSelection.length - 1)
    )
      return;
    const updated = [...tempSelection];
    [updated[index], updated[index + direction]] = [updated[index + direction], updated[index]];
    setTempSelection(updated);
  }

  // Main friend rendering
  function renderFriendsGrid(arr, { highlightIds = [], selectable = false } = {}) {
    return (
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        margin: '20px 0 0 0',
        minHeight: 70
      }}>
        {arr.map((friend, idx) => (
          <div
            key={friend._id}
            onClick={
              selectable ? () => handleToggleFriend(friend._id) : undefined
            }
            style={{
              cursor: selectable ? "pointer" : "default",
              opacity: selectable && highlightIds.length && !highlightIds.includes(friend._id) ? 0.5 : 1,
              border: highlightIds.includes(friend._id) ? "2.5px solid #facc15" : "2.5px solid #23273a",
              borderRadius: 11,
              padding: 9,
              background: '#181a22',
              boxShadow: '0 2px 10px #0006',
              width: 110,
              textAlign: 'center',
              position: 'relative',
              transition: 'box-shadow 0.13s, border 0.12s'
            }}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' && selectable) handleToggleFriend(friend._id);
            }}
          >
            <a
              href={`/profile/${friend.username}`}
              style={{ textDecoration: 'none', color: '#ffe066', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              tabIndex={-1}
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
                  border: highlightIds.includes(friend._id) ? "2.5px solid #facc15" : "2.5px solid #23273a",
                  marginBottom: 7,
                  background: "#181818"
                }}
              />
              <span style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#ffe066",
                wordBreak: "break-all",
                textAlign: 'center'
              }}>
                {friend.fullName || friend.username}
              </span>
            </a>
            {selectable && highlightIds.includes(friend._id) && tempSelection.length > 1 && (
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 5 }}>
                <button
                  style={{
                    background: '#ffe066', color: '#23273a', border: 'none', borderRadius: 6,
                    fontWeight: 900, fontSize: 14, padding: '2px 9px', cursor: 'pointer'
                  }}
                  disabled={idx === 0}
                  onClick={e => { e.stopPropagation(); moveSelection(idx, -1); }}
                >↑</button>
                <button
                  style={{
                    background: '#ffe066', color: '#23273a', border: 'none', borderRadius: 6,
                    fontWeight: 900, fontSize: 14, padding: '2px 9px', cursor: 'pointer'
                  }}
                  disabled={idx === tempSelection.length - 1}
                  onClick={e => { e.stopPropagation(); moveSelection(idx, 1); }}
                >↓</button>
              </div>
            )}
            {selectable && highlightIds.includes(friend._id) && (
              <div style={{
                position: "absolute", top: 3, right: 6, background: "#facc15",
                color: "#23273a", borderRadius: "50%", fontSize: 11, fontWeight: 800,
                padding: '1.5px 7px'
              }}>
                {tempSelection.indexOf(friend._id) + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Which friends to show in the "top" grid (edit or view)
  const displayFriends = editMode
    ? friends.filter(f => tempSelection.includes(f._id)).sort((a, b) =>
        tempSelection.indexOf(a._id) - tempSelection.indexOf(b._id)
      )
    : getTopFriendsArray();

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100vh',
      background: 'rgba(12,12,18,0.89)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3.5px)'
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(120deg, #191c25 70%, #181a1f 100%)',
          borderRadius: 22,
          minWidth: 400,
          maxWidth: 540,
          width: 'min(95vw, 520px)',
          boxShadow: '0 8px 46px #000c',
          padding: 38,
          position: 'relative',
          border: '2px solid #292b36'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 20, fontSize: 28, color: '#ffe066',
            background: 'rgba(40,35,45,0.76)', border: 'none', cursor: 'pointer',
            zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
            width: 44, height: 44, lineHeight: '40px', textAlign: 'center', transition: 'background 0.17s'
          }}
        >✕</button>
        <h2 style={{
          fontSize: 26, fontWeight: 800, color: "#ffe066", textAlign: "center", margin: "0 0 15px 0"
        }}>
          {editMode ? "Edit Top Friends" : "All Friends"}
        </h2>

        {/* Show grid of friends (edit or view mode) */}
        {editMode ? (
          <>
            <div style={{ color: "#ffe066", fontWeight: 600, fontSize: 15, textAlign: "center" }}>
              Select up to 8 friends to feature as your Top Friends. Tap/Click again to remove. Drag/Drop or use arrows to reorder.
            </div>
            {renderFriendsGrid(
              friends,
              { highlightIds: tempSelection, selectable: true }
            )}
          </>
        ) : (
          <>
            <div style={{ color: "#ffe066", fontWeight: 600, fontSize: 15, textAlign: "center" }}>
              {friends.length === 0
                ? "No friends yet."
                : `You have ${friends.length} friend${friends.length !== 1 ? "s" : ""}.`}
            </div>
            {renderFriendsGrid(friends)}
          </>
        )}

        {/* Save/Cancel Buttons (only edit mode) */}
        {editMode && (
          <div style={{ marginTop: 28, textAlign: "center" }}>
            <button
              style={{
                background: '#ffe066', color: '#23273a', border: 'none', borderRadius: 8,
                fontWeight: 700, fontSize: 16, padding: '8px 30px', marginRight: 12, cursor: 'pointer'
              }}
              disabled={tempSelection.length === 0 || tempSelection.length > 8}
              onClick={() => {
                onEditTopFriendsSave([...tempSelection]);
              }}
            >Save Top Friends</button>
            <button
              style={{
                background: '#222', color: '#ffe066', border: '1.5px solid #ffe066',
                borderRadius: 8, fontWeight: 700, fontSize: 16, padding: '8px 22px', cursor: 'pointer'
              }}
              onClick={() => { setTempSelection(editSelection); setEditMode(false); }}
            >Cancel</button>
          </div>
        )}

        {/* Edit button (for own profile) */}
        {!editMode && isOwnProfile && friends.length > 8 && (
          <div style={{ marginTop: 26, textAlign: "center" }}>
            <button
              style={{
                background: '#23273a', color: '#ffe066', border: '1.5px solid #ffe066', borderRadius: 8,
                fontWeight: 700, fontSize: 16, padding: '8px 28px', cursor: 'pointer'
              }}
              onClick={() => {
                setEditMode(true);
                setTempSelection(editSelection && editSelection.length ? editSelection : friends.slice(0, 8).map(f => f._id));
              }}
            >Edit Top Friends</button>
          </div>
        )}
      </div>
    </div>
  );
}
