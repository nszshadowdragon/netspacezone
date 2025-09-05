import React, { useEffect, useMemo, useRef, useState } from "react";

// Use same-origin in dev (Vite proxy), real host in prod.
// Optional: if uploads live on the deployed backend while you dev locally,
// set VITE_REMOTE_UPLOADS_BASE="https://<your-backend-host>"
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const REMOTE_UPLOADS_BASE =
  import.meta.env.VITE_REMOTE_UPLOADS_BASE ||
  import.meta.env.VITE_UPLOADS_PUBLIC_BASE ||
  "";

/** Build a prioritized list of candidate URLs that will work in dev + prod. */
function candidatesFrom(user, srcOverride) {
  const raws = [];
  if (srcOverride) raws.push(srcOverride);
  if (user) {
    raws.push(
      user.profileImageUrl,
      user.profilePic,
      user.profileImage,
      user.profileImg,
      user.avatarUrl,
      user.avatar
    );
  }
  const uniq = [];
  for (const r of raws) {
    const s = (r || "").toString().trim();
    if (!s || uniq.includes(s)) continue;
    uniq.push(s);
  }

  const out = [];

  // Keep absolute/data URLs as-is (highest priority)
  for (const s of uniq) {
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) out.push(s);
  }

  // For relative paths, try several bases so it "just works"
  const rels = uniq.filter((s) => !/^https?:\/\//i.test(s) && !/^data:/i.test(s));
  for (let s of rels) {
    s = s.replace(/\\/g, "/");
    if (!s.startsWith("/")) s = "/" + s;

    // 1) relative (Vite will proxy /uploads in dev)
    out.push(s);

    // 2) API_BASE + relative (prod)
    if (API_BASE && s.startsWith("/uploads")) out.push(`${API_BASE}${s}`);

    // 3) explicit localhost backend (common on dev machines)
    if (s.startsWith("/uploads")) out.push(`http://localhost:5000${s}`);

    // 4) optional remote uploads host (when images only exist on prod)
    if (REMOTE_UPLOADS_BASE && s.startsWith("/uploads"))
      out.push(`${REMOTE_UPLOADS_BASE.replace(/\/+$/, "")}${s}`);
  }

  // Final fallback (local asset)
  out.push("/profilepic.jpg");
  // Dedupe while preserving order
  return Array.from(new Set(out));
}

/** Cache the first working URL per user key to avoid jitter / re-fetch loops. */
const workingCache = new Map(); // key -> url

export default function AvatarImg({
  user,
  src,              // optional: override raw src
  size = 72,        // pixels
  alt,
  className = "",
  rounded = true,   // circle by default
  style = {},
  title,
}) {
  const key = useMemo(
    () => String(user?._id || user?.id || user?.username || src || "fallback"),
    [user?._id, user?.id, user?.username, src]
  );
  const list = useMemo(() => candidatesFrom(user, src), [user, src]);
  const [cur, setCur] = useState(() => workingCache.get(key) || list[0]);
  const idxRef = useRef(Math.max(0, list.indexOf(cur)));

  // Preconnect/prefetch to speed first paint
  useEffect(() => {
    // preconnect
    try {
      const u = new URL(cur, window.location.href);
      if (u.protocol.startsWith("http")) {
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = u.origin;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    } catch {}
    // prefetch next candidate as a hint
    if (list[1]) {
      const img = new Image();
      img.decoding = "async";
      // @ts-ignore
      img.fetchPriority = "high";
      img.loading = "eager";
      img.src = list[1];
    }
  }, [cur, list]);

  // If parent rerenders with a different user/src, pick the best known
  useEffect(() => {
    const cached = workingCache.get(key);
    if (cached) {
      setCur(cached);
      idxRef.current = list.indexOf(cached);
    } else {
      setCur(list[0]);
      idxRef.current = 0;
    }
  }, [key, list]);

  const onLoad = (e) => {
    workingCache.set(key, e.currentTarget.src);
  };

  const onError = () => {
    const nextIdx = Math.min(idxRef.current + 1, list.length - 1);
    idxRef.current = nextIdx;
    setCur(list[nextIdx]);
  };

  return (
    <img
      src={cur}
      alt={alt || user?.username || "avatar"}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      // @ts-ignore
      fetchPriority="high"
      onLoad={onLoad}
      onError={onError}
      title={title || (user ? `@${user.username}` : undefined)}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? "50%" : 12,
        objectFit: "cover",
        background: "#222",
        border: "2px solid #555",
        ...style,
      }}
      className={className}
      draggable={false}
    />
  );
}
