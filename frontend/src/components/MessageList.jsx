import React from "react";
import MessageBubble from "./MessageBubble";

export default function MessageList({
  messages,
  myUserId,
  myUsername,
  userMap,
  editingMsgId,
  editText,
  onEditClick,
  onDelete,
  onEditSave,
  onEditCancel,
  onEditTextChange,
  onReact
}) {
  return (
    <>
      {messages.length > 0 ? messages.map((msg, i) => {
        const fromId = typeof msg.from === "object" ? msg.from._id : msg.from;
        const isOwn = fromId === myUserId;
        const senderUser = typeof msg.from === "object"
          ? msg.from
          : userMap[msg.from] || { username: "Unknown", profileImage: "/default-avatar.png" };
        const isEditing = editingMsgId === msg._id;

        return (
          <div
            key={msg._id || msg.id || i}
            style={{
              display: "flex",
              justifyContent: isOwn ? "flex-end" : "flex-start",
              padding: "8px 14px"
            }}
          >
            <div style={{ maxWidth: "85%" }}>
              <MessageBubble
                msg={{
                  ...msg,
                  isOwn,
                  senderName: isOwn
                    ? myUsername || "You"
                    : senderUser.username || senderUser.fullName || "Unknown"
                }}
                isOwn={isOwn}
                senderAvatar={senderUser.profileImage || "/default-avatar.png"}
                onReact={onReact}
                onEdit={onEditClick}
              />

              {isOwn && (
                <div style={{ marginTop: 4, textAlign: "right" }}>
                  <button style={{ fontSize: 12, color: "#ffe066", background: "none", border: "none", cursor: "pointer", marginRight: 6 }}
                    onClick={() => onEditClick(msg._id, msg.text)}>
                    Edit
                  </button>
                  <button style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => onDelete(msg._id)}>
                    Delete
                  </button>
                </div>
              )}

              {isEditing && (
                <div style={{ marginTop: 6 }}>
                  <textarea
                    value={editText}
                    onChange={onEditTextChange}
                    style={{
                      width: "100%",
                      minHeight: 40,
                      padding: "6px",
                      borderRadius: 6,
                      fontSize: 15,
                      marginBottom: 4
                    }}
                  />
                  <button style={{ marginRight: 8, background: "#ffe066", color: "#191900", border: "none", borderRadius: 7, padding: "5px 18px", fontWeight: 700, cursor: "pointer" }}
                    onClick={() => onEditSave(msg._id, editText)}>
                    Save
                  </button>
                  <button style={{ background: "#191900", color: "#ffe066", border: "1.5px solid #ffe066", borderRadius: 7, padding: "5px 18px", fontWeight: 700, cursor: "pointer" }}
                    onClick={onEditCancel}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      }) : (
        <div style={{ color: "#ffe06688", marginTop: 12, fontWeight: 700, fontSize: 17 }}>
          No messages found.
        </div>
      )}
    </>
  );
}
