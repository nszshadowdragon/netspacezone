import React from "react";

export default function UserListItem({
  user,
  selected,
  isFriend,
  onClick,
  requestMsg,
  unreadCount // Pass unreadCount prop from ChatBox
}) {
  // Helper: Always serve image from backend if it's an uploads path
  const getAvatarUrl = (avatar) => {
    if (!avatar) return "/default-avatar.png";
    if (avatar.startsWith("/uploads/")) {
      return `http://localhost:5000${avatar}`;
    }
    return avatar;
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "#18181b" : "transparent",
        borderLeft: selected ? "3px solid #ffe066" : "3px solid transparent",
        padding: "10px 14px 10px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 11,
        minHeight: 58,
        borderBottom: "1px solid #242426",
        transition: "background 0.13s, border 0.13s",
        position: "relative"
      }}
    >
      {/* Profile Image */}
      <div style={{ position: "relative" }}>
        <img
          src={getAvatarUrl(user.profileImage)}
          alt={user.username}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            objectFit: "cover",
            border: selected ? "2.2px solid #ffe066" : "1.4px solid #232321",
            boxShadow: selected ? "0 0 8px #ffe06655" : "none",
            background: "#18181b"
          }}
        />
        {/* Online dot (bottom right) */}
        <span
          style={{
            position: "absolute",
            bottom: 2,
            right: 2,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: user.online ? "#6cff6b" : "#434334",
            border: "1.4px solid #101014"
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: "#ffe066", fontSize: 17, display: "flex", alignItems: "center" }}>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 160,
              display: "inline-block"
            }}
          >
            {user.username || user.fullName || "Unknown"}
          </span>
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span
              style={{
                background: "#ffe066",
                color: "#191900",
                fontWeight: 900,
                borderRadius: 11,
                padding: "2px 9px",
                fontSize: 13,
                marginLeft: 10,
                minWidth: 18,
                display: "inline-block",
                boxShadow: "0 2px 8px #ffe0663c"
              }}
              title={`${unreadCount} unread`}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {requestMsg ? (
          <div style={{ color: "#ffe066a6", fontSize: 13, marginTop: 2, minHeight: 16 }}>{requestMsg}</div>
        ) : isFriend ? (
          <div style={{ color: "#ffe066b6", fontSize: 13, marginTop: 2, minHeight: 16 }}>
            {/* Placeholder for preview or status */}
          </div>
        ) : null}
      </div>
    </div>
  );
}
