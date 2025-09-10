import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AvatarImg
 * - Preloads the chosen URL, shows a skeleton until it's ready (no alt-text flash)
 * - Forces remount on user change (via key from caller or cacheKey)
 * - Tries multiple URL candidates (absolute > localhost:5000 > API_BASE(sanitized) > relative)
 * - Eager + async load for snappier first paint
 */

// --- NEW: base sanitizers to avoid https://api.localhost:5000 ---
function sanitizeBase(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const isLoopback =
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      // subdomain like api.localhost
      /\.?localhost$/i.test(u.hostname);

    if (isLoopback) {
      u.protocol = "http:";
      if (!u.port) u.port = "5000";
    }
    // drop trailing slash
    return u.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = sanitizeBase(RAW_API_BASE);

const REMOTE_UPLOADS_BASE =
  import.meta.env.VITE_REMOTE_UPLOADS_BASE ||
  import.meta.env.VITE_UPLOADS_PUBLIC_BASE ||
  "";

/* Build possible URLs for a given image-like field */
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

    // 1) explicit local backend (fast/dev) — always http://localhost:5000
    if (s.startsWith("/uploads")) out.push(`http://localhost:5000${s}`);

    // 2) sanitized API_BASE (prod or proxy; never https on localhost)
    if (API_BASE && s.startsWith("/uploads")) out.push(`${API_BASE}${s}`);

    // 3) optional remote uploads (prod only, left as provided)
    if (REMOTE_UPLOADS_BASE && s.startsWith("/uploads"))
      out.push(`${String(REMOTE_UPLOADS_BASE).replace(/\/+$/, "")}${s}`);

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
  alt,
  className = "",
  rounded = true,
  style = {},
  title,
  eager = true,
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
    setReady(Boolean(cached));
  }, [cacheKey, list]);

  // preload the target URL; only swap <img> in once decoded
  useEffect(() => {
    if (!targetUrl || ready) return;

    try {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = targetUrl;
      document.head.appendChild(link);
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
      const nextIdx = Math.min(idxRef.current + 1, list.length - 1);
      if (nextIdx !== idxRef.current) {
        idxRef.current = nextIdx;
        setTargetUrl(list[nextIdx]);
        setReady(false);
      } else {
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
      key={cacheKey}
      style={boxStyle}
      className={className}
      aria-label={title || (user ? `@${user.username}` : undefined)}
    >
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
