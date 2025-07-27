import React, { useState, useRef } from "react";

const REACTION_EMOJIS = ["👍", "😂", "❤️", "🔥", "😮", "😢"];

export default function MessageBubble({
  msg,
  isOwn,
  senderAvatar,
  onReact,
  onEdit,
  style = {}
}) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.text);
  const editInputRef = useRef();

  const getAvatarUrl = (avatar) => {
    if (!avatar) return "/default-avatar.png";
    if (avatar.startsWith("/uploads/")) {
      return `http://localhost:5000${avatar}`;
    }
    return avatar;
  };

  const handleShowActions = (e) => {
    e.preventDefault();
    setShowActions(true);
  };
  const handleHideActions = () => setShowActions(false);

  const startEdit = () => {
    setEditValue(msg.text);
    setEditing(true);
    setShowActions(false);
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 80);
  };

  const submitEdit = () => {
    if (editValue.trim() && editValue !== msg.text) {
      onEdit?.(msg._id, editValue);
    }
    setEditing(false);
  };

  return (
    <div
      onContextMenu={handleShowActions}
      onDoubleClick={handleShowActions}
      onTouchStart={handleShowActions}
      onMouseLeave={handleHideActions}
      style={{
        maxWidth: '82%',
        background: isOwn ? "#ffe0661a" : "#16161b", // current user: goldish, others: dark
        color: "#ffe066",
        borderRadius: 14,
        marginBottom: 13,
        boxShadow: '0 1px 7px #000c',
        padding: "14px 18px 11px 18px",
        fontWeight: 600,
        fontSize: 16,
        position: "relative",
        wordBreak: "break-word",
        cursor: "pointer",
        marginLeft: isOwn ? "auto" : undefined, // ⭐️ THIS IS THE FIX
        ...style
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexDirection: isOwn ? "row-reverse" : "row" }}>
        <img
          src={getAvatarUrl(senderAvatar)}
          alt={msg.senderName || "avatar"}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            objectFit: "cover",
            marginTop: 2,
            background: "#19191d",
            border: "1.2px solid #232321"
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 800,
            fontSize: 13,
            color: "#ffe066",
            marginBottom: 2,
            textAlign: isOwn ? "right" : "left"
          }}>
            {isOwn ? "You" : msg.senderName || msg.sender}
            <span style={{
              fontWeight: 500,
              color: "#ffe066a6",
              marginLeft: 9,
              fontSize: 12
            }}>
              {new Date(msg.createdAt || msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {msg.edited && <span style={{ fontSize: 11, color: "#bfa02e", marginLeft: 5 }} title="edited">*</span>}
            </span>
          </div>
          {!editing ? (
            <div style={{ fontSize: 16 }}>
              {msg.text}
              {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                <span style={{ marginLeft: 8, display: "inline-flex", gap: 3, fontSize: 14 }}>
                  {msg.reactions.map((r, i) => (
                    <span key={i} style={{ padding: "0 3px", background: "#19191d", borderRadius: 7, color: "#ffe066" }}>
                      {r.emoji}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ) : (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={submitEdit}
              onKeyDown={e => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{
                fontSize: 16,
                background: "#fffde7",
                color: "#191900",
                borderRadius: 6,
                padding: "3px 7px",
                border: "1px solid #ffe066",
                width: "100%",
                boxSizing: "border-box"
              }}
              autoFocus
            />
          )}
        </div>
      </div>

      {showActions && (
        <div style={{
          display: "flex",
          gap: 2,
          position: "absolute",
          right: isOwn ? 0 : undefined,
          left: !isOwn ? 0 : undefined,
          bottom: -29,
          background: "#19191d",
          borderRadius: 8,
          padding: "3px 6px",
          boxShadow: "0 3px 12px #0009",
          zIndex: 3,
          border: "1px solid #ffe0664b"
        }}>
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              style={{
                fontSize: 15,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#ffe066",
                padding: "0 2px"
              }}
              onClick={() => { onReact?.(msg._id, emoji); setShowActions(false); }}
              tabIndex={-1}
            >
              {emoji}
            </button>
          ))}
          {isOwn && (
            <button
              style={{
                fontSize: 13,
                background: "none",
                border: "none",
                color: "#ffe066",
                marginLeft: 3,
                cursor: "pointer"
              }}
              onClick={startEdit}
              tabIndex={-1}
              title="Edit"
            >
              ✏️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
