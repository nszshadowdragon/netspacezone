// EnhancedPoll.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const buttonClass =
  'px-3 py-1 rounded border transition-colors hover:bg-gray-300';

export default function EnhancedPoll({ onPollSubmit, onVote }) {
  // editing mode vs voting mode
  const [isEditing, setIsEditing] = useState(true);

  // Poll creation states
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  // Voting state
  const [votes, setVotes] = useState([]);
  const [userVote, setUserVote] = useState(null);

  // When poll is submitted, switch to voting mode
  const submitPoll = () => {
    // Ensure at least one non-empty option exists
    const options = pollOptions.filter((opt) => opt.trim() !== '');
    if (!pollQuestion.trim() || options.length < 2) {
      alert('Please provide a poll question and at least 2 options.');
      return;
    }
    setPollOptions(options);
    setVotes(options.map(() => 0));
    setIsEditing(false);
    // If you want to pass poll data to parent, call onPollSubmit({ pollQuestion, pollOptions })
    if (onPollSubmit) {
      onPollSubmit({ pollQuestion, pollOptions });
    }
  };

  // Handler to add a new poll option input
  const addOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  // Handler to remove an option by index
  const removeOption = (index) => {
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  // Handler for when a vote is cast in voting mode
  const handleVote = (index) => {
    if (userVote !== null) return; // prevent multiple votes
    setUserVote(index);
    const newVotes = votes.map((v, i) => (i === index ? v + 1 : v));
    setVotes(newVotes);
    if (onVote) {
      onVote(index);
    }
  };

  // Compute total votes for displaying percentages
  const totalVotes = votes.reduce((acc, v) => acc + v, 0);
  const percentages = votes.map((v) =>
    totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0
  );

  return (
    <div className="p-4 border rounded bg-gray-100">
      {isEditing ? (
        <>
          <h4 className="text-lg font-bold mb-2">Create a Poll</h4>
          <input
            type="text"
            className="w-full border rounded p-2 mb-3"
            placeholder="Enter your poll question"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
          />
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center mb-2">
              <input
                type="text"
                className="w-full border rounded p-2"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...pollOptions];
                  newOptions[index] = e.target.value;
                  setPollOptions(newOptions);
                }}
              />
              {pollOptions.length > 2 && (
                <button
                  onClick={() => removeOption(index)}
                  className="ml-2 px-2 py-1 bg-red-500 text-white rounded"
                >
                  X
                </button>
              )}
            </div>
          ))}
          <button onClick={addOption} className={`${buttonClass} mb-3`}>
            Add Option
          </button>
          <div className="flex justify-end space-x-2">
            <button
              onClick={submitPoll}
              className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save Poll
            </button>
            <button
              onClick={() => {
                // Optionally allow canceling poll creation
                setIsEditing(false);
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h4 className="text-lg font-bold mb-2">{pollQuestion}</h4>
          {userVote === null ? (
            <AnimatePresence>
              <div className="flex flex-col space-y-2">
                {pollOptions.map((option, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => handleVote(idx)}
                    className={`${buttonClass} w-full text-left`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {option}
                  </motion.button>
                ))}
              </div>
            </AnimatePresence>
          ) : (
            <ul className="list-disc list-inside">
              {pollOptions.map((option, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-1 relative"
                >
                  {option}: {votes[idx]} vote{votes[idx] !== 1 ? 's' : ''}
                  {userVote === idx && (
                    <span className="ml-2 text-green-600 font-bold">(Your vote)</span>
                  )}
                  {totalVotes > 0 && (
                    <div className="mt-1 h-2 w-full bg-gray-300 rounded">
                      <div
                        className="h-full bg-teal-500 rounded"
                        style={{ width: `${percentages[idx]}%` }}
                      ></div>
                    </div>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
          {userVote !== null && (
            <div className="mt-3 text-sm text-gray-700">
              Total Votes: {totalVotes}
            </div>
          )}
          {/* Optionally allow editing poll after creation */}
          <div className="flex justify-end mt-3 space-x-2">
            <button
              onClick={() => {
                // Reset vote so user can re-edit poll (for testing)
                setUserVote(null);
                setVotes(pollOptions.map(() => 0));
              }}
              className="px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Reset Vote
            </button>
            <button
              onClick={() => {
                // Return to editing mode to allow changes
                setIsEditing(true);
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Edit Poll
            </button>
          </div>
        </>
      )}
    </div>
  );
}
