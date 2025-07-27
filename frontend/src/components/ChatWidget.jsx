// src/components/ChatWidget.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import io  from 'socket.io-client';

function ChatListBox({ rooms, selectedChat, setSelectedChat }) {
  const [filter, setFilter] = useState('');
  const withMsgs = rooms.filter(r => r.lastMessage)
                        .sort((a, b) => new Date(b.time) - new Date(a.time));
  const noMsgs   = rooms.filter(r => !r.lastMessage)
                        .sort((a, b) => a.name.localeCompare(b.name));
  const visible  = [...withMsgs, ...noMsgs].filter(r =>
                  r.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-2 flex flex-col h-full">
      <input
        type="text"
        placeholder="Search friends..."
        className="mb-2 p-2 border rounded text-sm"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="overflow-y-auto flex-1">
        {visible.map(r => {
          const isSel = selectedChat?.id === r.id;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedChat(r)}
              className={`p-2 mb-1 cursor-pointer rounded ${
                isSel
                  ? 'bg-teal-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold">{r.name}</span>
                {r.online && <span className="w-2 h-2 bg-green-500 rounded-full" />}
              </div>
              {r.lastMessage && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {r.lastMessage}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-sm text-gray-400 mt-4">No friends found</div>
        )}
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const { theme: globalTheme } = useTheme();
  const [isOpen, setIsOpen]           = useState(false);
  const [activeTab, setActiveTab]     = useState('chats');
  const [rooms, setRooms]             = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [autoScroll]                  = useState(true);

  const socketRef   = useRef();
  const CHAT_SERVER = import.meta.env.VITE_CHAT_SERVER;

  /* ─── Fetch rooms ───────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    api.get('/chat')
       .then(res => setRooms(res.data.chats || []))
       .catch(err => console.error('[ChatWidget] load rooms error', err));
  }, [isOpen]);

  /* ─── Socket connection ─────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('authToken');
    socketRef.current = io(CHAT_SERVER, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current.on('connect_error', err =>
      console.error('[ChatWidget] socket error', err)
    );
    socketRef.current.on('chatMessage', msg => {
      setRooms(prev =>
        prev.map(r =>
          r.id === msg.chatId
            ? { ...r, lastMessage: msg.text || '📷 GIF', time: msg.timestamp }
            : r
        )
      );
      if (msg.chatId === selectedChat?.id) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => socketRef.current.disconnect();
  }, [isOpen, CHAT_SERVER, selectedChat]);

  /* ─── Join room & history ───────────────────── */
  useEffect(() => {
    if (!selectedChat) return;
    socketRef.current.emit('joinChat', selectedChat.id);
    api.get(`/chat/${selectedChat.id}/messages`)
       .then(res => setMessages(res.data.messages || []))
       .catch(err => console.error('[ChatWidget] load history error', err));
  }, [selectedChat]);

  /* ─── Auto-scroll ───────────────────────────── */
  const endRef = useRef();
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  /* ─── Send message ──────────────────────────── */
  const sendMessage = useCallback(() => {
    if (!messageInput.trim() || !selectedChat) return;
    const msg = {
      id: Date.now(),
      chatId: selectedChat.id,
      text: messageInput,
      username: 'You',
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit('chatMessage', msg);
    setMessages(prev => [...prev, msg]);
    setMessageInput('');
  }, [messageInput, selectedChat]);

  /* ─── Presentation helpers ──────────────────── */
  const panelClass = window.innerWidth < 768
    ? 'fixed bottom-0 right-0 w-full'
    : 'fixed bottom-4 right-4 w-80';
  const appliedTheme =
    globalTheme === 'light'
      ? 'bg-white'
      : globalTheme === 'dark'
      ? 'bg-black'
      : 'bg-gradient-to-r from-red-900 to-purple-900';

  /* ─── Render ─────────────────────────────────── */
  return (
    <AnimatePresence>
      {!isOpen ? (
        <div
          className="fixed bottom-4 right-4 px-4 py-2 rounded bg-teal-500 text-white cursor-pointer z-50"
          onClick={() => setIsOpen(true)}
        >
          Chat
        </div>
      ) : (
        <motion.div
          key="chatPanel"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`${panelClass} ${appliedTheme} rounded shadow-lg flex flex-col z-50`}
          style={{ maxHeight: '600px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b text-white">
            <h4 className="font-bold">Messages</h4>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            {['chats', 'groups', 'requests'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedChat(null); }}
                className={`flex-1 p-2 text-sm ${
                  activeTab === tab ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            <div className="w-1/3 border-r">
              {activeTab === 'chats' && (
                <ChatListBox
                  rooms={rooms}
                  selectedChat={selectedChat}
                  setSelectedChat={setSelectedChat}
                />
              )}
            </div>
            <div className="w-2/3 flex flex-col p-2 overflow-y-auto">
              {selectedChat ? (
                <>
                  <div className="font-bold mb-2">{selectedChat.name}</div>
                  <div className="flex-1 overflow-y-auto">
                    {messages.map(m => (
                      <div key={m.id} className="mb-2 p-2 bg-gray-200 dark:bg-gray-800 rounded">
                        <div>{m.text}</div>
                        <div className="text-xs text-gray-500">
                          {m.username} @ {new Date(m.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                </>
              ) : (
                <div className="text-gray-400">Select a chat to start messaging</div>
              )}
            </div>
          </div>

          {/* Input */}
          {selectedChat && (
            <div className="border-t p-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 p-2 border rounded"
                  placeholder="Type your message…"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 bg-teal-500 text-white rounded"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
