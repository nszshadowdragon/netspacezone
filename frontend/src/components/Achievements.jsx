// src/components/Achievements.jsx
import React, { useState } from 'react';
import { FaCheckCircle, FaTrophy } from 'react-icons/fa';

export default function Achievements({ theme }) {
  const [achievements, setAchievements] = useState([
    { id: 1, title: 'Verified', icon: 'check', color: 'text-green-400' },
    { id: 2, title: 'Top Contributor', icon: 'check', color: 'text-yellow-400' },
  ]);

  const awardAchievement = () => {
    const nextId = achievements.length + 1;
    setAchievements(prev => [
      ...prev,
      { id: nextId, title: 'Milestone Achieved', icon: 'trophy', color: 'text-blue-400' }
    ]);
  };

  // Card styling based on theme
  const cardClasses =
    theme === 'light'
      ? 'bg-white text-gray-900'
      : 'bg-white/10 text-white backdrop-blur-sm border border-white/20';

  return (
    <div className={`${cardClasses} p-4 rounded shadow mb-6`}>
      <h3 className="text-xl font-bold mb-2">Achievements</h3>
      <div className="flex space-x-4">
        {achievements.map(a => (
          <div key={a.id} className="flex flex-col items-center">
            {a.icon === 'check' ? (
              <FaCheckCircle size={32} className={a.color} />
            ) : (
              <FaTrophy size={32} className={a.color} />
            )}
            <p className="text-sm mt-1">{a.title}</p>
          </div>
        ))}
      </div>
      <button
        onClick={awardAchievement}
        className="mt-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
      >
        Award Achievement
      </button>
    </div>
  );
}
