import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AvatarImg
 * - Preloads the chosen URL, shows a skeleton until it's ready (no alt-text flash)
 * - Forces remount on user change (via key from caller or cacheKey)
 * - Tries multiple URL candidates (absolute > localhost:5000 > relative)
 * - Eager + async load for snappier first paint (good for profile header & search chips)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const REMOTE_UPLOADS_BASE =
  import.meta.env.VITE_REMOTE_UPLOADS_BASE ||
  import.meta.env.VITE_UPLOADS_PUBLIC_BASE ||
  "";

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

  // Absolute/data stay as-is
  for (const s of uniq) {
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) out.push(s);
  }

  // Relative → generate a few absolute options
  const rels = uniq.filter((s) => !/^https?:\/\//i.test(s) && !/^data:/i.test(s));
  for (let s of rels) {
    s = s.replace(/\\/g, "/");
    if (!s.startsWith("/")) s = "/" + s;

    // 1) explicit local backend (fast/dev)
    if (s.startsWith("/uploads")) out.push(`http://localhost:5000${s}`);

    // 2) API_BASE (prod or proxy)
    if (API_BASE && s.startsWith("/uploads")) out.push(`${API_BASE}${s}`);

    // 3) optional remote uploads (prod only)
    if (REMOTE_UPLOADS_BASE && s.startsWith("/uploads"))
      out.push(`${REMOTE_UPLOADS_BASE.replace(/\/+$/, "")}${s}`);

    // 4) raw relative (last)
    out.push(s);
  }

  // Dedupe preserve order
  return Array.from(new Set(out));
}

// cache the first successful URL per user key
const workingCache = new Map(); // key -> url

export default function AvatarImg({
  user,
  src,                 // optional explicit src
  size = 72,
  alt,                 // NOTE: alt is applied only when image is shown (to avoid text flash)
  className = "",
  rounded = true,
  style = {},
  title,
  eager = true,        // eager by default (good for search/profile header)
}) {
  const cacheKey = useMemo(
    () => String(user?._id || user?.id || user?.username || src || "fallback"),
    [user?._id, user?.id, user?.username, src]
  );
  const list = useMemo(() => candidatesFrom(user, src), [user, src]);

  // current "final" URL we want to use (either from cache or first candidate)
  const [targetUrl, setTargetUrl] = useState(() => workingCache.get(cacheKey) || list[0] || "");
  // show skeleton until the chosen targetUrl fully loads
  const [ready, setReady] = useState(Boolean(workingCache.get(cacheKey)));

  const idxRef = useRef(Math.max(0, list.indexOf(targetUrl)));

  // when identity changes, pick cached (if any) or first candidate and reset "ready"
  useEffect(() => {
    const cached = workingCache.get(cacheKey);
    const first = list[0] || "";
    const chosen = cached || first;
    setTargetUrl(chosen);
    idxRef.current = Math.max(0, list.indexOf(chosen));
    setReady(Boolean(cached)); // ready immediately if cached was found
  }, [cacheKey, list]);

  // preload the target URL; only swap <img> in once decoded
  useEffect(() => {
    if (!targetUrl || ready) return;

    // create <link rel="preload"> hint
    try {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = targetUrl;
      document.head.appendChild(link);
      // GC later
      setTimeout(() => {
        try { document.head.removeChild(link); } catch {}
      }, 5000);
    } catch {}

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    // @ts-ignore
    img.fetchPriority = eager ? "high" : "auto";
    img.loading = eager ? "eager" : "lazy";
    img.onload = () => {
      if (cancelled) return;
      workingCache.set(cacheKey, targetUrl);
      setReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      // try the next candidate fast
      const nextIdx = Math.min(idxRef.current + 1, list.length - 1);
      if (nextIdx !== idxRef.current) {
        idxRef.current = nextIdx;
        setTargetUrl(list[nextIdx]);
        setReady(false);
      } else {
        // all failed → keep skeleton (no alt flash)
        setReady(false);
      }
    };
    img.src = targetUrl;

    // prefetch one more candidate in the background (if exists)
    if (list[idxRef.current + 1]) {
      const img2 = new Image();
      img2.decoding = "async";
      img2.src = list[idxRef.current + 1];
    }

    return () => {
      cancelled = true;
    };
  }, [targetUrl, cacheKey, ready, eager, list]);

  // shared box style to hold space (prevents layout shift)
  const boxStyle = {
    width: size,
    height: size,
    borderRadius: rounded ? "50%" : 12,
    overflow: "hidden",
    display: "inline-block",
    lineHeight: 0,
    ...style,
  };

  return (
    <span
      key={cacheKey} // force remount on user switch
      style={boxStyle}
      className={className}
      aria-label={title || (user ? `@${user.username}` : undefined)}
    >
      {/* Skeleton shown until final image decoded; avoids any alt-text flash */}
      {!ready && (
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "inherit",
            background:
              "radial-gradient(100% 100% at 50% 0%, #222 0%, #151515 60%, #0f0f0f 100%)",
            border: "1px solid #2a2a2a",
            animation: "nszPulse 0.5s ease-in-out 2",
          }}
          aria-hidden="true"
        />
      )}

      <style>{`
        @keyframes nszPulse {
          0% { opacity: .55; }
          50% { opacity: .85; }
          100% { opacity: .55; }
        }
      `}</style>

      {/* Only render the actual <img> once we know it’s ready */}
      {ready && (
        <img
          src={targetUrl}
          alt={alt || (user?.username ? `@${user.username}` : "")}
          width={size}
          height={size}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          // @ts-ignore
          fetchPriority={eager ? "high" : "auto"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            background: "#111",
            border: "1px solid #2a2a2a",
          }}
          draggable={false}
        />
      )}
    </span>
  );
}
