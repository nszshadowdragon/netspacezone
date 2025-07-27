import React from "react";
import { FaTimes, FaChevronLeft } from "react-icons/fa";

// Minimal moon SVG icon for theme toggle (subtle)
function MoonIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#ffe066">
      <path d="M21 12.79A9 9 0 0111.21 3a7 7 0 108.79 9.79z" />
    </svg>
  );
}

const getAvatarUrl = (avatar) => {
  if (!avatar) return "/default-avatar.png";
  if (avatar.startsWith("/uploads/")) {
    return `http://localhost:5000${avatar}`;
  }
  return avatar;
};

export default function ChatHeader({
  onClose,
  showBack,
  onBack,
  onThemeToggle,
  selectedUser,
  children // For optional content (like tabs)
}) {
  // Determine what to show for the avatar (group or individual)
  let avatarUrl = null;
  let displayName = "Messages";
  if (showBack && selectedUser) {
    if (selectedUser.groupImage) {
      avatarUrl = getAvatarUrl(selectedUser.groupImage);
      displayName = selectedUser.groupName || selectedUser.name || "Group Chat";
    } else {
      avatarUrl = getAvatarUrl(selectedUser.profileImage);
      displayName = selectedUser.username || selectedUser.name || selectedUser.fullName || "Unknown";
    }
  }

  return (
    <div style={{
      background: "#18181b",
      color: "#ffe066",
      fontWeight: 900,
      fontSize: 21,
      borderBottom: "2px solid #242426",
      padding: "15px 25px 12px 17px",
      letterSpacing: 0.3,
      display: "flex",
      alignItems: "center",
      gap: 10,
      minHeight: 60
    }}>
      {/* Back arrow OR theme toggle */}
      {showBack ? (
        <button
          style={{
            background: "none", border: "none", color: "#ffe066",
            fontSize: 23, marginRight: 9, cursor: "pointer", display: "flex", alignItems: "center"
          }}
          onClick={onBack}
          aria-label="Back"
          title="Back"
        >
          <FaChevronLeft />
        </button>
      ) : (
        <button
          style={{
            background: "none", border: "none", color: "#ffe066",
            fontSize: 17, marginRight: 9, cursor: "pointer", display: "flex", alignItems: "center", opacity: 0.82
          }}
          onClick={onThemeToggle}
          aria-label="Theme Selector"
          title="Change chat theme"
        >
          <MoonIcon size={17} />
        </button>
      )}

      {/* Avatar for user or group */}
      {showBack && avatarUrl && (
        <img
          src={avatarUrl}
          alt={displayName}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            objectFit: "cover",
            marginRight: 9,
            background: "#18181b",
            border: "1.7px solid #ffe06699",
            boxShadow: "0 0 7px #ffe06622"
          }}
        />
      )}

      {/* Title or selected user name */}
      <span style={{
        fontWeight: 900,
        fontSize: 21,
        letterSpacing: 0.4,
        marginLeft: showBack ? 0 : 4
      }}>
        {displayName}
      </span>
      {/* (Optional: children for tabs) */}
      {children && (
        <div style={{ marginLeft: 18, flex: 1 }}>{children}</div>
      )}
      <div style={{ flex: 1 }} />
      {/* Close button */}
      <button
        style={{
          background: "none", border: "none", color: "#ffe066",
          fontSize: 21, cursor: "pointer"
        }}
        onClick={onClose}
        title="Close"
        aria-label="Close"
      >
        <FaTimes />
      </button>
    </div>
  );
}
