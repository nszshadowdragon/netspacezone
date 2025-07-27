import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import axios from 'axios';

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

export default function NotificationBell({
  userId,
  notifications: parentNotifications = [],
  filterState,
  setFilterState,
  onViewAll,
}) {
  const [notifications, setNotifications] = useState(parentNotifications);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const bellRef = useRef();

  useEffect(() => {
    setNotifications(parentNotifications);
  }, [parentNotifications]);

  const filteredNotifications = notifications.filter(
    n => filterState?.[n.type] !== false
  );
  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleNewNotification = notif => {
      setNotifications(prev => [notif, ...prev]);
      window.dispatchEvent(new Event('notifications:update'));
    };
    const handleRemoveNotification = notifId => {
      setNotifications(prev => prev.filter(n => (n._id || n.id) !== notifId));
    };
    socket.on('newNotification', handleNewNotification);
    socket.on('removeNotification', handleRemoveNotification);
    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('removeNotification', handleRemoveNotification);
    };
  }, []);

  const markAllRead = () => {
    axios.post('/api/notifications/read-all', {}, { withCredentials: true })
      .then(() => {
        setNotifications(n =>
          n.map(notif =>
            filterState?.[notif.type] !== false ? { ...notif, read: true } : notif
          )
        );
        window.dispatchEvent(new Event('notifications:update'));
      });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setFilterDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      markAllRead();
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, filterDropdownOpen]);

  const handleToggleFilter = (type) => {
    setFilterState(f => ({
      ...f,
      [type]: f[type] === false ? true : false
    }));
  };

  return (
    <div style={{ position: 'relative' }} ref={bellRef}>
      <button
        onClick={() => setDropdownOpen(open => !open)}
        style={{
          background: 'none', border: 'none', position: 'relative',
          fontSize: 26, color: '#ffe066', cursor: 'pointer'
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#f87171', color: '#fff', borderRadius: '50%',
            padding: '2px 6px', fontSize: 12, fontWeight: 800,
            border: '2px solid #18181b'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute', right: 0, top: 36,
          background: '#1b1b22', color: '#ffe066', borderRadius: 12,
          minWidth: 340, maxWidth: 400, maxHeight: 370, overflowY: 'auto',
          boxShadow: '0 2px 24px #000a', zIndex: 1000, padding: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{
              fontWeight: 900, margin: '6px 0 12px 0', letterSpacing: 1, fontSize: 17
            }}>Notifications</h4>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setFilterDropdownOpen(f => !f)}
                style={{
                  background: 'none', border: 'none', fontSize: 18, color: '#ffe066',
                  cursor: 'pointer', padding: '4px'
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

          {filteredNotifications.length === 0 ? (
            <div style={{ color: '#bbb', textAlign: 'center', margin: '18px 0' }}>
              No notifications yet.
            </div>
          ) : (
            filteredNotifications.map((notif, i) => (
              <div key={notif._id || i} style={{
                marginBottom: 12,
                borderBottom: '1px solid #292929',
                paddingBottom: 10,
                background: notif.read ? 'none' : '#ffe06616',
                borderRadius: 6,
                fontWeight: notif.read ? 500 : 800,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}>
                <img
                  src={getProfileImageSrc(notif.actor?.profileImage || notif.fromProfileImage)}
                  alt={notif.actor?.username || 'User'}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    marginTop: 1
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div>
                    <span style={{ color: '#ffec99', fontWeight: 700 }}>
                      {notif.actor?.username || notif.fromUsername || 'User'}
                    </span>{' '}
                    <span>
                      {notif.type === 'like' && '❤️'}
                      {notif.type === 'comment' && '💬'}
                      {notif.type === 'reply' && '↪️'}
                      {notif.type === 'friend_request' && '👥'}
                      {notif.type === 'follow' && '➕'}
                      {notif.type === 'system' && '🔔'}
                    </span>{' '}
                    {notif.message.replace(notif.actor?.username || '', '').trim()}
                    {notif.link &&
                      <a href={notif.link} style={{ color: '#66b3ff', marginLeft: 8 }}>View</a>}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                    {new Date(notif.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}

          <button
            style={{
              width: '100%',
              background: '#ffe066', color: '#222', border: 'none', borderRadius: 7,
              fontWeight: 700, fontSize: 15, padding: '7px 0', cursor: 'pointer', marginTop: 8
            }}
            onClick={() => {
              setDropdownOpen(false);
              if (onViewAll) onViewAll();
            }}
          >
            View All
          </button>
        </div>
      )}
    </div>
  );
}
