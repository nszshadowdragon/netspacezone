import React, { useEffect, useMemo, useState } from "react";
import { saveTopFriends } from "../utils/socialApi";
import UserActionButton from "./UserActionButton";

/**
 * FriendsPopup
 * - Shows All Friends (and optional Top Friends editor for your own profile)
 * - Each friend row includes a UserActionButton (Add / Accept / Decline / Cancel / Unfriend)
 * - Fixes edit-selection reordering (works against the selection order, not grid index)
 * - Normalizes /uploads avatar URLs via VITE_API_BASE_URL (no hardcoded localhost)
 */

export default function FriendsPopup({
  friends = [],
  topFriends = [],
  isEditing = false,
  editSelection = [],
  setEditSelection = () => {},
  myUserId,
  isOwnProfile,
  onClose,
  onEditTopFriendsSave = () => {},
}) {
  // local copy so we can optimistically remove after "Unfriend"
  const [friendsList, setFriendsList] = useState(friends);
  useEffect(() => setFriendsList(friends), [friends]);

  const [editMode, setEditMode] = useState(isEditing);
  const [tempSelection, setTempSelection] = useState(
    (editSelection && editSelection.length ? editSelection : topFriends) || []
  );
  const [filter, setFilter] = useState("");

  // Auto close edit if <= 8
  useEffect(() => {
    if ((friendsList || []).length <= 8) setEditMode(false);
  }, [friendsList.length]);

  // ---------- helpers ----------
  const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  const API_BASE =
    (import.meta?.env?.VITE_API_BASE_URL ||
      import.meta?.env?.VITE_API_BASE ||
      (isLocal ? "http://localhost:5000" : ""))?.replace?.(/\/$/, "") || "";

  const getId = (f) => String(f?._id || f?.id || "");
  const getUsername = (f) => String(f?.username || f?.userName || f?.name || "user");

  function avatarUrl(friend) {
    const raw = friend?.profileImage || friend?.profilePic || "";
    if (!raw) return `https://ui-avatars.com/api/?name=${encodeURIComponent(getUsername(friend))}`;
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    const p = raw.startsWith("/uploads") ? raw : `/uploads/${String(raw).replace(/^\/+/, "")}`;
    return `${API_BASE}${p}`;
  }

  // Returns Top-8 in desired order (or plain list if <= 8 / no config)
  function getTopFriendsArray(source) {
    const arr = Array.isArray(source) ? source : [];
    if (arr.length <= 8 || !topFriends || !topFriends.length) return arr;
    const lookup = new Map(arr.map((f) => [getId(f), f]));
    return topFriends.map((id) => lookup.get(String(id))).filter(Boolean);
  }

  // Select/deselect in edit mode (up to 8)
  function handleToggleFriend(friendId) {
    const fid = String(friendId);
    let selection = [...tempSelection];
    if (selection.includes(fid)) selection = selection.filter((id) => id !== fid);
    else if (selection.length < 8) selection.push(fid);
    setTempSelection(selection);
  }

  // Move selection *by selection index*, not grid index
  function moveSelection(selIndex, direction) {
    if (
      selIndex < 0 ||
      selIndex >= tempSelection.length ||
      (direction === -1 && selIndex === 0) ||
      (direction === 1 && selIndex === tempSelection.length - 1)
    )
      return;
    const updated = [...tempSelection];
    [updated[selIndex], updated[selIndex + direction]] = [
      updated[selIndex + direction],
      updated[selIndex],
    ];
    setTempSelection(updated);
  }

  // Filtered view for "All Friends"
  const filteredFriends = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return friendsList;
    return friendsList.filter((f) => {
      const u = getUsername(f).toLowerCase();
      const n = String(f?.fullName || "").toLowerCase();
      return u.includes(q) || n.includes(q);
    });
  }, [friendsList, filter]);

  // Which friends to show in the TOP grid (edit or view)
  const displayFriends = useMemo(() => {
    if (editMode) {
      const inSel = new Set(tempSelection.map(String));
      const onlySelected = friendsList.filter((f) => inSel.has(getId(f)));
      // sort by selection order
      const order = new Map(tempSelection.map((id, i) => [String(id), i]));
      return onlySelected.sort(
        (a, b) => (order.get(getId(a)) ?? 0) - (order.get(getId(b)) ?? 0)
      );
    }
    return getTopFriendsArray(friendsList);
  }, [editMode, friendsList, tempSelection]);

  // ---------- rendering ----------
  function FriendCard({ friend, selectable = false }) {
    const fid = getId(friend);
    const uname = getUsername(friend);
    const selected = tempSelection.includes(fid);
    const selIndex = tempSelection.indexOf(fid);

    return (
      <div
        key={fid}
        onClick={selectable ? () => handleToggleFriend(fid) : undefined}
        style={{
          cursor: selectable ? "pointer" : "default",
          opacity: selectable && tempSelection.length && !selected ? 0.6 : 1,
          border: selected ? "2.5px solid #facc15" : "2.5px solid #23273a",
          borderRadius: 11,
          padding: 9,
          background: "#181a22",
          boxShadow: "0 2px 10px #0006",
          width: 140,
          textAlign: "center",
          position: "relative",
          transition: "box-shadow 0.13s, border 0.12s",
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" && selectable) handleToggleFriend(fid);
        }}
      >
        <a
          href={`/profile/${uname}`}
          style={{
            textDecoration: "none",
            color: "#ffe066",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={avatarUrl(friend)}
            alt={uname}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              objectFit: "cover",
              border: selected ? "2.5px solid #facc15" : "2.5px solid #23273a",
              marginBottom: 8,
              background: "#181818",
            }}
          />
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "#ffe066",
              wordBreak: "break-word",
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {friend.fullName || uname}
          </span>
        </a>

        {/* Inline friend action (won't trigger selection) */}
        {getId(friend) !== String(myUserId || "") && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 8, display: "flex", justifyContent: "center" }}
          >
            <UserActionButton
              userId={fid}
              username={uname}
              variant="compact"
              onChangeStatus={(next) => {
                // If we unfriended successfully while viewing our own list,
                // remove the user from local list for immediate feedback.
                if (isOwnProfile && next === "none") {
                  setFriendsList((curr) => curr.filter((x) => getId(x) !== fid));
                  // also remove from selection if present
                  setTempSelection((sel) => sel.filter((id) => String(id) !== fid));
                }
              }}
            />
          </div>
        )}

        {/* Edit SELECTED index badge + arrows */}
        {selectable && selected && (
          <>
            <div
              style={{
                position: "absolute",
                top: 3,
                right: 6,
                background: "#facc15",
                color: "#23273a",
                borderRadius: "50%",
                fontSize: 11,
                fontWeight: 800,
                padding: "1.5px 7px",
              }}
            >
              {selIndex + 1}
            </div>
            {tempSelection.length > 1 && (
              <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 6 }}>
                <button
                  style={arrowBtnStyle}
                  disabled={selIndex <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSelection(selIndex, -1);
                  }}
                >
                  ↑
                </button>
                <button
                  style={arrowBtnStyle}
                  disabled={selIndex === tempSelection.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveSelection(selIndex, 1);
                  }}
                >
                  ↓
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderFriendsGrid(arr, { selectable = false } = {}) {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          margin: "16px 0 0 0",
          minHeight: 70,
          justifyContent: "center",
        }}
      >
        {arr.map((friend) => (
          <FriendCard key={getId(friend)} friend={friend} selectable={selectable} />
        ))}
      </div>
    );
  }

  const arrowBtnStyle = {
    background: "#ffe066",
    color: "#23273a",
    border: "none",
    borderRadius: 6,
    fontWeight: 900,
    fontSize: 14,
    padding: "2px 9px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100vh",
        background: "rgba(12,12,18,0.89)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(3.5px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(120deg, #191c25 70%, #181a1f 100%)",
          borderRadius: 22,
          minWidth: 420,
          maxWidth: 720,
          width: "min(96vw, 680px)",
          boxShadow: "0 8px 46px #000c",
          padding: 24,
          position: "relative",
          border: "2px solid #292b36",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 18,
            fontSize: 28,
            color: "#ffe066",
            background: "rgba(40,35,45,0.76)",
            border: "none",
            cursor: "pointer",
            zIndex: 8,
            fontWeight: "bold",
            borderRadius: "50%",
            boxShadow: "0 2px 10px #0008",
            width: 44,
            height: 44,
            lineHeight: "40px",
            textAlign: "center",
            transition: "background 0.17s",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>

        {/* Title + filter */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#ffe066",
              margin: 0,
              textAlign: "left",
            }}
          >
            {editMode ? "Edit Top Friends" : "All Friends"}
          </h2>

          {!editMode && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter friends…"
              style={{
                width: 220,
                maxWidth: "58vw",
                padding: "8px 10px",
                borderRadius: 10,
                background: "#11131a",
                border: "1.5px solid #2b2f44",
                color: "#ffe066",
                fontWeight: 700,
              }}
            />
          )}
        </div>

        {/* Subhead */}
        {!editMode ? (
          <div
            style={{
              color: "#ffe066",
              fontWeight: 600,
              fontSize: 14,
              textAlign: "left",
            }}
          >
            {friendsList.length === 0
              ? "No friends yet."
              : `You have ${friendsList.length} friend${friendsList.length !== 1 ? "s" : ""}.`}
          </div>
        ) : (
          <div
            style={{
              color: "#ffe066",
              fontWeight: 600,
              fontSize: 14,
              textAlign: "left",
            }}
          >
            Select up to 8 friends to feature as your Top Friends. Click to toggle; use arrows to reorder.
          </div>
        )}

        {/* Content */}
        {editMode
          ? renderFriendsGrid(friendsList, { selectable: true })
          : renderFriendsGrid(filteredFriends, { selectable: false })}

        {/* Save/Cancel (edit mode) */}
        {editMode && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <button
              style={{
                background: "#ffe066",
                color: "#23273a",
                border: "none",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 16,
                padding: "10px 26px",
                marginRight: 12,
                cursor: "pointer",
              }}
              disabled={tempSelection.length === 0 || tempSelection.length > 8}
              onClick={async () => {
                try {
                  const res = await saveTopFriends(tempSelection);
                  const nextTop =
                    res?.data?.topFriends && Array.isArray(res.data.topFriends)
                      ? res.data.topFriends
                      : tempSelection;
                  onEditTopFriendsSave(nextTop);
                  setEditSelection(nextTop);
                  setEditMode(false);
                } catch (err) {
                  alert("Failed to save top friends.");
                }
              }}
            >
              Save Top Friends
            </button>
            <button
              style={{
                background: "#222",
                color: "#ffe066",
                border: "1.5px solid #ffe066",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 16,
                padding: "10px 22px",
                cursor: "pointer",
              }}
              onClick={() => {
                setTempSelection(editSelection);
                setEditMode(false);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Edit button for own profile if >8 friends */}
        {!editMode && isOwnProfile && friendsList.length > 8 && (
          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button
              style={{
                background: "#23273a",
                color: "#ffe066",
                border: "1.5px solid #ffe066",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 16,
                padding: "10px 26px",
                cursor: "pointer",
              }}
              onClick={() => {
                setEditMode(true);
                setTempSelection(
                  editSelection && editSelection.length
                    ? editSelection.map(String)
                    : friendsList.slice(0, 8).map((f) => getId(f))
                );
              }}
            >
              Edit Top Friends
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
