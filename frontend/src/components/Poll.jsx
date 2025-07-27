// Poll.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function Poll({ poll, onVote }) {
  const [userVote, setUserVote] = useState(poll.userVote ?? null);
  const [votes, setVotes] = useState(poll.votes ?? poll.options.map(() => 0));
  const [isVoting, setIsVoting] = useState(false);

  // Update local state when the poll prop changes.
  useEffect(() => {
    setUserVote(poll.userVote ?? null);
    setVotes(poll.votes ?? poll.options.map(() => 0));
  }, [poll]);

  const handleVote = (optionIndex) => {
    if (userVote !== null || isVoting) return; // Prevent multiple votes
    setIsVoting(true);
    setUserVote(optionIndex);
    const newVotes = [...votes];
    newVotes[optionIndex] += 1;
    setVotes(newVotes);
    if (onVote) onVote(optionIndex);
    // Brief delay to disable further voting
    setTimeout(() => setIsVoting(false), 300);
  };

  return (
    <div className="mt-4 p-2 border rounded bg-gray-100">
      <h4 className="font-bold mb-2">Poll: {poll.question}</h4>
      <AnimatePresence exitBeforeEnter>
        {userVote === null ? (
          <div className="flex flex-col space-y-2">
            {poll.options.map((option, idx) => (
              <motion.button
                key={idx}
                onClick={() => handleVote(idx)}
                className="px-3 py-1 border rounded hover:bg-gray-300"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                whileTap={{ scale: 0.95 }}
                disabled={isVoting}
              >
                {option}
              </motion.button>
            ))}
          </div>
        ) : (
          <ul className="list-disc list-inside">
            {poll.options.map((option, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {option}: {votes[idx]} vote{votes[idx] !== 1 ? 's' : ''}
                {userVote === idx && (
                  <span className="ml-2 text-green-600 font-bold">(Your vote)</span>
                )}
              </motion.li>
            ))}
          </ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PollCreator({
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  addPollOption,
  removePollOption,
  savePoll,
  cancelPoll,
}) {
  return (
    <div className="p-4 border rounded bg-gray-100">
      <label className="block text-sm font-medium mb-1">Poll Question</label>
      <input
        type="text"
        className="w-full border rounded p-2 mb-2"
        value={pollQuestion}
        onChange={(e) => setPollQuestion(e.target.value)}
        placeholder="Enter your poll question"
      />
      {pollOptions.map((option, index) => (
        <div key={index} className="flex items-center mb-2">
          <input
            type="text"
            className="w-full border rounded p-2"
            value={option}
            onChange={(e) => {
              const newOptions = [...pollOptions];
              newOptions[index] = e.target.value;
              setPollOptions(newOptions);
            }}
            placeholder={`Option ${index + 1}`}
          />
          <button
            onClick={() => removePollOption(index)}
            className="ml-2 px-2 py-1 bg-red-500 text-white rounded"
          >
            X
          </button>
        </div>
      ))}
      <button onClick={addPollOption} className="px-3 py-1 bg-green-500 text-white rounded mb-2">
        Add Option
      </button>
      <div className="flex space-x-2">
        <button onClick={savePoll} className="px-3 py-1 bg-blue-500 text-white rounded">
          Save Poll
        </button>
        <button onClick={cancelPoll} className="px-3 py-1 bg-gray-500 text-white rounded">
          Cancel Poll
        </button>
      </div>
    </div>
  );
}
