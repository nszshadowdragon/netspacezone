// src/components/CommentsSection.jsx
import React, { useState } from "react";

/**
 * CommentsSection component
 *
 * Props:
 * - postId: string
 * - meId: string
 * - comments: array of comment objects
 * - onAdd: async function(text) -> adds new comment
 * - onEdit: async function(commentId, text) -> edits comment
 * - onDelete: async function(commentId) -> deletes comment
 */
export default function CommentsSection({
  postId,
  meId,
  comments = [],
  onAdd,
  onEdit,
  onDelete,
}) {
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onAdd?.(text);
      setNewText("");
    } catch (err) {
      alert(err.message || "Failed to add comment");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id) => {
    const text = editText.trim();
    if (!text) return;
    setSaving(true);
    try {
      await onEdit?.(id, text);
      setEditingId(null);
      setEditText("");
    } catch (err) {
      alert(err.message || "Failed to edit comment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    setSaving(true);
    try {
      await onDelete?.(id);
    } catch (err) {
      alert(err.message || "Failed to delete comment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ marginBottom: 8, fontWeight: 900 }}>
        Comments ({comments.length})
      </h4>

      {/* New comment box */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            resize: "vertical",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !newText.trim()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #10b981",
            background: "#10b981",
            color: "#fff",
            fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Post
        </button>
      </div>

      {/* Comments list */}
      {comments.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: 14 }}>
          No comments yet. Be the first to comment.
        </div>
      )}
      {comments.map((c) => {
        const isOwner = String(c?.user?._id || "") === String(meId);
        return (
          <div
            key={c._id}
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "8px 0",
              display: "flex",
              gap: 8,
            }}
          >
            {c?.user?.profileImage && (
              <img
                src={c.user.profileImage}
                alt={c?.user?.username || "user"}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{c?.user?.username || "unknown"}</span>
                <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12 }}>
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>

              {editingId === c._id ? (
                <>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      resize: "vertical",
                      marginBottom: 6,
                    }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleEdit(c._id)}
                      disabled={saving || !editText.trim()}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #10b981",
                        background: "#10b981",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #ccc",
                        background: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 14, whiteSpace: "pre-wrap", marginBottom: 6 }}>
                  {c.text}
                </p>
              )}

              {isOwner && editingId !== c._id && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditingId(c._id);
                      setEditText(c.text);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#3b82f6",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(c._id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#ef4444",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
