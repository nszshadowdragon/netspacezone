import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timeoutRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate(); // Initialize useNavigate

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    setError('');
    setLoading(false);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!val.trim()) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(val)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const users = await res.json();
        setResults(users);
        setDropdownOpen(true);
        setLoading(false);
      } catch (err) {
        setError('Could not search.');
        setLoading(false);
      }
    }, 350); // debounce
  }

  function handleSelectUser(username) {
    setDropdownOpen(false);
    setQuery('');
    navigate(`/profile/${username}`); // Use SPA navigation
  }

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (
        !e.target.closest('.nsz-searchbar') &&
        !e.target.closest('.nsz-search-dropdown')
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <div className="nsz-searchbar" style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search NSZ users..."
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => query && results.length && setDropdownOpen(true)}
        style={{
          padding: '0.5rem',
          borderRadius: '6px',
          border: '1px solid #555',
          width: '100%',
          backgroundColor: '#000',
          color: '#fff'
        }}
      />
      {dropdownOpen && (
        <div
          className="nsz-search-dropdown"
          style={{
            position: 'absolute',
            top: '2.3rem',
            left: 0,
            right: 0,
            background: '#111',
            color: '#ffe066',
            borderRadius: 7,
            boxShadow: '0 6px 24px #000e',
            zIndex: 1300,
            padding: '0.6rem 0'
          }}
        >
          {loading && <div style={{ padding: '0.8rem 1.2rem', color: '#fff' }}>Searching...</div>}
          {error && <div style={{ padding: '0.8rem 1.2rem', color: '#f87171' }}>{error}</div>}
          {!loading && !error && results.length === 0 && (
            <div style={{ padding: '0.8rem 1.2rem', color: '#fffde6' }}>No results.</div>
          )}
          {results.map(u => (
            <div
              key={u.username}
              onClick={() => handleSelectUser(u.username)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                padding: '0.6rem 1.2rem',
                borderBottom: '1px solid #232323'
              }}
              onMouseDown={e => e.preventDefault()} // keep input focused
            >
              <img
                src={u.profileImage ? (u.profileImage.startsWith('http')
                  ? u.profileImage
                  : `/uploads/${u.profileImage}`) : '/assets/avatar-placeholder.png'}
                alt={u.username}
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  background: '#222',
                  border: '2px solid #555'
                }}
              />
              <span style={{ fontWeight: 700, color: '#ffe066' }}>{u.fullName || u.username}</span>
              <span style={{ color: '#bbb', fontSize: 13 }}>@{u.username}</span>
              {u.bio && <span style={{
                color: '#fffde6',
                fontStyle: 'italic',
                fontSize: 13,
                marginLeft: 8
              }}>{u.bio.slice(0, 36)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
