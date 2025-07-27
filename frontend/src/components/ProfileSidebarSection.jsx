import React from 'react';

export default function ProfileSidebarSection({
  cardStyle,
  sectionTitle,
  groups,
  highlights,
  interests,
  recommendations,
}) {
  return (
    <div style={{ flex: '1 1 35%', minWidth: 280 }}>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Groups Membership</h2>
        <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
          {groups.map((g, i) => <li key={i} style={{ marginBottom: 6 }}>{g}</li>)}
        </ul>
      </div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Highlights</h2>
        <div style={{ display: 'flex', gap: '1.2rem', marginBottom: 4 }}>
          {highlights.map((h, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <img
                src={h.imageUrl}
                alt={h.title}
                style={{
                  width: '5.5rem',
                  height: '5.5rem',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '0.6rem',
                  border: '2.5px solid #facc15',
                  boxShadow: '0 2px 10px #0006'
                }}
              />
              <p style={{ color: '#ffe066', fontSize: '0.97rem', margin: 0 }}>{h.title}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <button style={{
          padding: '0.7rem 1.6rem',
          background: '#facc15',
          color: '#000',
          border: 'none',
          borderRadius: '7px',
          fontWeight: 800,
          fontSize: '1.08rem',
          cursor: 'pointer',
          letterSpacing: 1,
          boxShadow: '0 2px 10px #0004'
        }}>
          Contact / Message
        </button>
      </div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Privacy & Visibility</h2>
        <select style={{
          width: '100%',
          padding: '0.7rem',
          borderRadius: '7px',
          background: '#000',
          color: '#facc15',
          border: '1.5px solid #353535',
          fontWeight: 600,
          fontSize: '1.05rem'
        }}>
          <option>Public</option>
          <option>Friends</option>
          <option>Private</option>
        </select>
      </div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Interests & Skills</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem' }}>
          {interests.map((tag, i) => (
            <span key={i} style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '9999px',
              background: '#222',
              color: '#facc15',
              fontWeight: 700,
              fontSize: '0.99rem',
              letterSpacing: 1
            }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Recommendations</h2>
        {recommendations.map((r, i) => (
          <blockquote key={i} style={{ fontStyle: 'italic', marginBottom: '1.1rem', color: '#fffde6' }}>
            "{r.text}"<footer style={{ textAlign: 'right', marginTop: '0.5rem', color: '#ffe066' }}>- {r.author}</footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
