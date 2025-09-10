// frontend/src/components/UserActionButton.jsx
import React, { useMemo } from "react";
import { FaUserPlus, FaUserCheck, FaTimes, FaCheck, FaUserMinus, FaSpinner, FaClock } from "react-icons/fa";
import useFriendship from "../hooks/useFriendship";

/**
 * UserActionButton
 * Unified Add / Accept / Decline / Cancel / Unfriend control.
 *
 * Props:
 *  - userId?: string
 *  - username?: string
 *  - variant?: "full" | "compact" | "icon"   (default: "full")
 *  - showIcons?: boolean                     (default: true)
 *  - className?: string
 *  - style?: React.CSSProperties
 *  - onChangeStatus?: (nextStatus: string) => void
 *
 * Usage:
 *  <UserActionButton userId={profileUser._id} username={profileUser.username} />
 */

const BTN = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 800,
    cursor: "pointer",
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    padding: "6px 10px",
    background: "#141414",
    color: "#ffe066",
    lineHeight: 1,
    userSelect: "none",
  },
  gold: {
    background: "#ffe066",
    color: "#111",
    border: "1px solid #deb64c",
  },
  danger: {
    background: "transparent",
    color: "#ff9a9a",
    border: "1px solid #3b1f1f",
  },
  subtle: {
    background: "#1a1a1a",
    color: "#ffe066",
    border: "1px solid #2b2b2b",
  },
  disabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};

export default function UserActionButton({
  userId = "",
  username = "",
  variant = "full",
  showIcons = true,
  className = "",
  style = {},
  onChangeStatus,
}) {
  const { status, busy, request, cancel, accept, decline, unfriend, FRIEND_STATUS } = useFriendship({
    userId,
    username,
  });

  const isSelf = status === FRIEND_STATUS.SELF;

  const labelSet = useMemo(() => {
    const L = {
      add: "Add",
      requested: "Requested",
      cancel: "Cancel",
      accept: "Accept",
      decline: "Decline",
      unfriend: "Unfriend",
      friends: "Friends",
    };
    if (variant === "icon") {
      Object.keys(L).forEach((k) => (L[k] = ""));
    } else if (variant === "compact") {
      L.requested = "Pending";
      L.unfriend = "Remove";
    }
    return L;
  }, [variant]);

  function btn(label, icon, kind = "subtle", onClick, ariaLabel) {
    const s = {
      ...BTN.base,
      ...(kind === "gold" ? BTN.gold : kind === "danger" ? BTN.danger : BTN.subtle),
      ...(busy ? BTN.disabled : null),
      ...(style || {}),
    };
    return (
      <button
        type="button"
        className={className}
        style={s}
        disabled={busy}
        onClick={onClick}
        aria-label={ariaLabel || label || "action"}
      >
        {busy ? <FaSpinner style={{ animation: "spin .8s linear infinite" }} /> : showIcons && icon}
        {!!label && <span>{label}</span>}
        <style>{`@keyframes spin {from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
      </button>
    );
  }

  if (isSelf) return null;

  if (status === FRIEND_STATUS.NONE) {
    return btn(
      labelSet.add,
      <FaUserPlus />,
      "gold",
      async () => {
        const r = await request();
        onChangeStatus && onChangeStatus(r.statusText);
      },
      "Add friend"
    );
  }

  if (status === FRIEND_STATUS.PENDING) {
    return (
      <div style={{ display: "inline-flex", gap: 6 }}>
        {btn(
          variant === "icon" ? "" : labelSet.requested,
          variant === "icon" ? <FaClock /> : <FaClock />,
          "subtle",
          () => {},
          "Pending request"
        )}
        {btn(
          labelSet.cancel,
          <FaTimes />,
          "danger",
          async () => {
            const r = await cancel();
            onChangeStatus && onChangeStatus(r.statusText);
          },
          "Cancel request"
        )}
      </div>
    );
  }

  if (status === FRIEND_STATUS.INCOMING) {
    return (
      <div style={{ display: "inline-flex", gap: 6 }}>
        {btn(
          labelSet.accept,
          <FaCheck />,
          "gold",
          async () => {
            const r = await accept();
            onChangeStatus && onChangeStatus(r.statusText);
          },
          "Accept friend request"
        )}
        {btn(
          labelSet.decline,
          <FaTimes />,
          "danger",
          async () => {
            const r = await decline();
            onChangeStatus && onChangeStatus(r.statusText);
          },
          "Decline friend request"
        )}
      </div>
    );
  }

  if (status === FRIEND_STATUS.FRIENDS) {
    return btn(
      variant === "icon" ? "" : labelSet.unfriend,
      variant === "icon" ? <FaUserMinus /> : <FaUserCheck />,
      "subtle",
      async () => {
        const r = await unfriend();
        onChangeStatus && onChangeStatus(r.statusText);
      },
      "Unfriend"
    );
  }

  return btn(
    labelSet.add,
    <FaUserPlus />,
    "gold",
    async () => {
      const r = await request();
      onChangeStatus && onChangeStatus(r.statusText);
    },
    "Add friend"
  );
}
