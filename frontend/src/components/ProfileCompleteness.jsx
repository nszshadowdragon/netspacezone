import React from 'react';
export default function ProfileCompleteness({ theme }) {
  return (
    <div className="p-4 mb-6 rounded bg-white/20 backdrop-blur-sm">
      <h3 className="font-bold mb-2">Profile Completeness (stub)</h3>
      <div className="w-full bg-gray-700 h-2 rounded overflow-hidden">
        <div className="bg-green-500 h-full" style={{ width: '40%' }} />
      </div>
      <p className="text-sm mt-1">40% complete</p>
    </div>
  );
}
