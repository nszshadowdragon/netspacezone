import React from "react";
import { FaSmile, FaImage, FaPaperclip, FaMicrophone, FaPaperPlane } from "react-icons/fa";

export default function ChatInputBar({
  messageInput,
  setMessageInput,
  onSend
}) {
  return (
    <div style={{
      background: "#18181b", borderTop: "1.2px solid #242426", padding: "10px 0 13px 0"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 8,
        background: "none"
      }}>
        <button><FaSmile /></button>
        <button><FaImage /></button>
        <button><FaPaperclip /></button>
        <button><FaMicrophone /></button>
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 20px 0 20px",
        marginTop: 2
      }}>
        <textarea
          value={messageInput}
          onChange={e => setMessageInput(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            borderRadius: 10,
            border: "none",
            fontSize: 16,
            padding: "12px 18px 12px 18px",
            fontWeight: 700,
            background: "#141417",
            color: "#ffe066",
            resize: "none",
            minHeight: 40,
            maxHeight: 120,
            boxShadow: "0 1px 6px #ffe06611",
            outline: "none"
          }}
          rows={1}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          onClick={onSend}
          style={{
            background: "#ffe066",
            color: "#191900",
            border: "none",
            borderRadius: 10,
            padding: "13px 19px",
            fontWeight: 900,
            fontSize: 21,
            cursor: messageInput.trim() ? "pointer" : "not-allowed",
            opacity: messageInput.trim() ? 1 : 0.45,
            boxShadow: "0 2px 10px #ffe06618"
          }}
          disabled={!messageInput.trim()}
          title="Send"
          tabIndex={0}
        >
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
}
