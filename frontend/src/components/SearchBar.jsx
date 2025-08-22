import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Dummy static user list for UI preview
  const dummyUsers = [
    { username: "demo1", fullName: "Demo User One", bio: "Just exploring NSZ", profilePic: "/profilepic.jpg" },
    { username: "demo2", fullName: "Demo User Two", bio: "Into music and gaming", profilePic: "/profilepic.jpg" },
    { username: "demo3", fullName: "Demo User Three", bio: "Frontend-only draft", profilePic: "/profilepic.jpg" }
  ];

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);

    if (!val.trim()) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }

    // Filter dummy users
    const filtered = dummyUsers.filter(
      u =>
        u.username.toLowerCase().includes(val.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(val.toLowerCase()))
    );

    setResults(filtered);
    setDropdownOpen(true);
  }

  function handleSelectUser(username) {
    setDropdownOpen(false);
    setQuery("");
    alert(`Navigate to /profile/${username} (dummy only)`);
    navigate(`/profile/${username}`);
  }

  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest(".nsz-searchbar") &&
        !e.target.closest(".nsz-search-dropdown")
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div className="nsz-searchbar" style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search NSZ users..."
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => query && results.length && setDropdownOpen(true)}
        style={{
          padding: "0.5rem",
          borderRadius: "6px",
          border: "1px solid #555",
          width: "100%",
          backgroundColor: "#000",
          color: "#fff"
        }}
      />

      {dropdownOpen && (
        <div
          className="nsz-search-dropdown"
          style={{
            position: "absolute",
            top: "2.3rem",
            left: 0,
            right: 0,
            background: "#111",
            color: "#ffe066",
            borderRadius: 7,
            boxShadow: "0 6px 24px #000e",
            zIndex: 1300,
            padding: "0.6rem 0"
          }}
        >
          {results.length === 0 && (
            <div style={{ padding: "0.8rem 1.2rem", color: "#fffde6" }}>
              No results.
            </div>
          )}
          {results.map((u) => (
            <div
              key={u.username}
              onClick={() => handleSelectUser(u.username)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                padding: "0.6rem 1.2rem",
                borderBottom: "1px solid #232323"
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <img
                src={u.profilePic}
                alt={u.username}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  objectFit: "cover",
                  background: "#222",
                  border: "2px solid #555"
                }}
              />
              <span style={{ fontWeight: 700, color: "#ffe066" }}>
                {u.fullName || u.username}
              </span>
              <span style={{ color: "#bbb", fontSize: 13 }}>@{u.username}</span>
              {u.bio && (
                <span
                  style={{
                    color: "#fffde6",
                    fontStyle: "italic",
                    fontSize: 13,
                    marginLeft: 8
                  }}
                >
                  {u.bio.slice(0, 36)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
