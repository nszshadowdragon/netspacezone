import React, { useState } from 'react';

// Notification types you use (expand as needed)
const NOTIFICATION_TYPES = [
  { type: 'like', label: 'Likes' },
  { type: 'comment', label: 'Comments' },
  { type: 'reply', label: 'Replies' },
  { type: 'friend_request', label: 'Friend Requests' },
  { type: 'follow', label: 'Follows' },
  { type: 'system', label: 'System' },
];

// Image helper
function getProfileImageSrc(src) {
  if (!src) return '/default-avatar.png';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/uploads')) return 'http://localhost:5000' + src;
  if (src.startsWith('/')) return src;
  return '/' + src;
}

export default function NotificationsPopup({
  notifications = [],
  filterState = {},
  setFilterState = () => {},
  onAccept = () => {},
  onDecline = () => {},
  onClear = () => {},
  onClearAll = () => {},
  onClose = () => {},
  markAllRead = () => {},
  onViewAll = () => {},
}) {
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const filtered = notifications.filter(n => filterState?.[n.type] !== false);

  const handleToggleFilter = (type) => {
    setFilterState(f => ({
      ...f,
      [type]: f[type] === false ? true : false
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100%', height: '100vh',
      background: 'rgba(15,15,20,0.97)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1c23',
          borderRadius: 20,
          minWidth: 350,
          maxWidth: 480,
          width: 'min(98vw, 430px)',
          boxShadow: '0 8px 44px #000d',
          padding: '38px 0 0 0',
          position: 'relative',
          border: '2px solid #292b36',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 17, right: 17, fontSize: 28, color: '#ffe066',
            background: 'rgba(40,35,45,0.82)', border: 'none', cursor: 'pointer',
            zIndex: 8, fontWeight: 'bold', borderRadius: '50%', boxShadow: '0 2px 10px #0008',
            width: 44, height: 44, lineHeight: '40px', textAlign: 'center'
          }}
        >✕</button>

        {/* Header / filter / actions */}
        <div style={{
          padding: '0 38px 8px 38px', borderBottom: '1px solid #252525',
          position: 'sticky', top: 0, zIndex: 2, background: '#1a1c23'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
            <h2 style={{
              fontSize: 23, fontWeight: 800, color: "#ffe066", textAlign: "center", margin: "0 0 12px 0", flex: 1
            }}>
              All Notifications
            </h2>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setFilterDropdownOpen(f => !f)}
                style={{
                  background: 'none', border: 'none', fontSize: 19, color: '#ffe066',
                  cursor: 'pointer', padding: '2px 5px'
                }}
                title="Filter notifications"
              >⚙️</button>
              {filterDropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 24,
                  background: '#222229', color: '#ffe066', borderRadius: 10,
                  minWidth: 160, boxShadow: '0 2px 14px #0009',
                  zIndex: 2000, padding: 12
                }}>
                  <div style={{
                    fontWeight: 800, fontSize: 15, marginBottom: 8, letterSpacing: 1
                  }}>Filter Types</div>
                  {NOTIFICATION_TYPES.map(({ type, label }) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontWeight: 600, flex: 1, cursor: 'pointer' }}>
                        {label}
                      </label>
                      <div
                        style={{
                          cursor: 'pointer',
                          width: 36, height: 20, borderRadius: 12, background: filterState?.[type] !== false ? '#ffe066' : '#2d2d31',
                          marginLeft: 7, position: 'relative', transition: 'background 0.18s'
                        }}
                        onClick={() => handleToggleFilter(type)}
                        aria-checked={filterState?.[type] !== false}
                        role="switch"
                        tabIndex={0}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%',
                          background: filterState?.[type] !== false ? '#232323' : '#888',
                          position: 'absolute',
                          left: filterState?.[type] !== false ? 16 : 2,
                          top: 2, transition: 'left 0.2s'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", marginBottom: 8 }}>
            <button
              onClick={markAllRead}
              style={{
                background: '#ffe066', color: '#232323', fontWeight: 700,
                border: 'none', borderRadius: 8, padding: '5px 16px', cursor: 'pointer'
              }}
            >
              Mark All Read
            </button>
            <button
              onClick={onClearAll}
              style={{
                background: '#f87171', color: '#fff', fontWeight: 700,
                border: 'none', borderRadius: 8, padding: '5px 16px', cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Main notification list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 38px 60px 38px', minHeight: 90 }}>
          {filtered.length === 0 ? (
            <div style={{ color: "#ffe066", fontWeight: 600, fontSize: 16, textAlign: "center", margin: "42px 0" }}>
              No notifications yet.
            </div>
          ) : (
            <div>
              {filtered.map(n => (
                <div key={n._id || n.createdAt} style={{
                  background: n.read ? '#191919' : '#2e260f',
                  color: n.read ? '#ffe066a0' : '#ffe066',
                  fontWeight: n.read ? 400 : 700,
                  marginBottom: 13,
                  borderRadius: 8,
                  position: 'relative',
                  padding: '12px 54px 12px 22px',
                  minHeight: 36,
                  boxShadow: n.read ? 'none' : '0 2px 16px #ffe06628',
                  display: "flex", alignItems: "center", gap: 10
                }}>
                  {/* Avatar */}
                  <img
                    src={getProfileImageSrc(n.actor?.profileImage || n.fromProfileImage)}
                    alt={n.actor?.username || 'User'}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
                      border: '1.5px solid #444', marginRight: 12
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <span style={{ color: '#ffec99', fontWeight: 700 }}>
                      {n.actor?.username || n.fromUsername || 'User'}
                    </span>{' '}
                    <span>
                      {n.type === 'like' && '❤️'}
                      {n.type === 'comment' && '💬'}
                      {n.type === 'reply' && '↪️'}
                      {n.type === 'friend_request' && '👥'}
                      {n.type === 'follow' && '➕'}
                      {n.type === 'system' && '🔔'}
                    </span>{' '}
                    {/* Avoid repeating the username */}
                    {n.message.replace(n.actor?.username || '', '').trim()}

                    {n.type === 'friend_request' && (
                      <>
                        <button
                          style={{
                            marginLeft: 8, background: '#ffe066', color: '#191919',
                            border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 14,
                            padding: '3px 12px', cursor: 'pointer'
                          }}
                          onClick={() => onAccept(n)}
                        >Accept</button>
                        <button
                          style={{
                            marginLeft: 8, background: '#191919', color: '#ffe066',
                            border: '1.3px solid #ffe066', borderRadius: 6, fontWeight: 700, fontSize: 14,
                            padding: '3px 12px', cursor: 'pointer'
                          }}
                          onClick={() => onDecline(n)}
                        >Decline</button>
                      </>
                    )}
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#66b3ff',
                          marginLeft: 10,
                          fontSize: 15,
                          textDecoration: 'underline',
                          fontWeight: 500
                        }}
                      >View</a>
                    )}
                    <div style={{ fontSize: 12, color: '#b7b378', marginTop: 2 }}>
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                  <button
                    style={{
                      background: "none", color: "#f87171", border: "none",
                      fontWeight: 800, fontSize: 18, cursor: "pointer", marginLeft: 8
                    }}
                    title="Clear"
                    onClick={() => onClear(n)}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* View All fixed at bottom */}
        <div style={{
          borderTop: '1px solid #232323', background: '#1a1c23',
          padding: '14px 38px', position: 'sticky', bottom: 0, zIndex: 2
        }}>
          <button
            style={{
              width: '100%',
              background: '#ffe066', color: '#222', border: 'none', borderRadius: 7,
              fontWeight: 700, fontSize: 15, padding: '7px 0', cursor: 'pointer'
            }}
            onClick={onViewAll}
          >
            View All
          </button>
        </div>
      </div>
    </div>
  );
}
