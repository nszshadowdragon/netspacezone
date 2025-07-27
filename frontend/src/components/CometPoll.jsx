// CometPoll.jsx
import React, { useState, useEffect } from 'react';
import { Poll } from './Poll';
import { motion, AnimatePresence } from 'framer-motion';

export default function CometPoll({ poll, onVote, className = '' }) {
  // Local state to compute vote percentages
  const [totalVotes, setTotalVotes] = useState(0);
  const [percentages, setPercentages] = useState([]);

  useEffect(() => {
    if (poll && poll.votes) {
      const total = poll.votes.reduce((acc, v) => acc + v, 0);
      setTotalVotes(total);
      const newPercentages = poll.votes.map((v) =>
        total > 0 ? Math.round((v / total) * 100) : 0
      );
      setPercentages(newPercentages);
    }
  }, [poll]);

  return (
    <div className={`Comet-poll-container bg-black bg-opacity-50 p-4 rounded ${className}`}>
      <h4 className="text-white text-xl font-bold mb-3">{poll.question}</h4>
      <div className="flex flex-col space-y-3">
        {poll.options.map((option, idx) => (
          <motion.button
            key={idx}
            onClick={() => onVote(idx)}
            className="w-full text-left px-4 py-2 border rounded bg-gray-800 hover:bg-gray-700 transition-colors text-white flex items-center justify-between"
            whileTap={{ scale: 0.97 }}
            disabled={poll.userVote !== null}
          >
            <span>
              {option}
              {poll.userVote === idx && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-600 rounded">Your vote</span>
              )}
            </span>
            <AnimatePresence>
              {poll.userVote !== null && (
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${percentages[idx]}%` }}
                  exit={{ width: 0 }}
                  className="bg-teal-500 h-full absolute top-0 right-0 opacity-50 z-[-1]"
                />
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
      {poll.userVote !== null && totalVotes > 0 && (
        <div className="mt-3 text-white text-sm">
          Total Votes: {totalVotes}
        </div>
      )}
    </div>
  );
}
