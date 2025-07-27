import React from 'react';
import { motion } from 'framer-motion';
import UserAvatar from './UserAvatar';

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ChatMessage({
  message,
  isOwnMessage,
  onDelete
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 10px'
      }}
    >
      {!isOwnMessage && (
        <UserAvatar
          src={message.senderAvatar}
          alt={message.senderName}
          size={34}
        />
      )}

      <div style={{
        background: isOwnMessage ? '#3a75f3' : '#2c2c2e',
        color: isOwnMessage ? '#fff' : '#ffe066',
        borderRadius: 10,
        padding: '10px 14px',
        maxWidth: '70%',
        position: 'relative',
        textAlign: 'left',
        marginLeft: isOwnMessage ? 0 : 10,
        marginRight: isOwnMessage ? 10 : 0
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
          {message.senderName || 'User'}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>
          {message.text}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
          {formatDate(message.date)}
        </div>

        {isOwnMessage && (
          <button
            onClick={() => onDelete(message._id)}
            style={{
              position: 'absolute',
              top: 6,
              right: 8,
              background: 'transparent',
              border: 'none',
              color: '#ff4b4b',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </motion.div>
  );
}
