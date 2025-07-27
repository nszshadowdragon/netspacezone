import React from 'react';
export default function InterestsSkills({ interests = [], theme }) {
  return (
    <div className="p-4 mb-6 rounded bg-white/20 backdrop-blur-sm">
      <h3 className="font-bold mb-2">Interests &amp; Skills (stub)</h3>
      {interests.length === 0
        ? <p className="italic text-gray-400">None listed</p>
        : interests.map((i) => <span key={i}>{i} </span>)}
    </div>
  );
}
