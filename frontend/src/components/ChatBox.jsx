import React, {
  useState, useEffect, useRef,
  forwardRef, useImperativeHandle
} from 'react';
import { io } from "socket.io-client";
import ChatHeader from './ChatHeader';
import UserListItem from './UserListItem';
import MessageList from './MessageList';
import ChatInputBar from './ChatInputBar';
import {
  getFriends,
  getFriendRequests,
  searchUsers,
  sendMessage,
  getMessages,
  editMessage,
  reactToMessage,
  getUnreadCounts
} from '../services/chatApi';
import { FaCommentDots, FaSearch } from 'react-icons/fa';

// Fix: Vite env
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const ChatBox = forwardRef(function ChatBox({ myUsername, myUserId, myProfileImage }, ref) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [mainSearch, setMainSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [messagedUsers, setMessagedUsers] = useState([]);
  const [outgoingMessagedUsers, setOutgoingMessagedUsers] = useState([]);
  const [backendChatUsers, setBackendChatUsers] = useState([]);
  const [messageRequests, setMessageRequests] = useState([]);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  // ---- ForwardRef for global control ----
  useImperativeHandle(ref, () => ({
    openChatWithUser: (user) => {
      setOpen(true);
      setSelectedUser(user);
    }
  }));

  useEffect(() => {
    async function getChatUsers() {
      try {
        const res = await fetch('http://localhost:5000/api/messages/chat-users', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        if (!res.ok) return;
        const users = await res.json();
        setBackendChatUsers(users.map(u => ({
          ...u,
          lastMessageAt: u.lastMessageAt || null,
          isFriend: false
        })));
      } catch (err) {}
    }
    getChatUsers();
  }, []);

  useEffect(() => {
    async function getMsgReq() {
      try {
        const res = await fetch('http://localhost:5000/api/messages/message-requests', {
          credentials: 'include'
        });
        if (!res.ok) return setMessageRequests([]);
        const users = await res.json();
        setMessageRequests(users);
      } catch {}
    }
    getMsgReq();
  }, [activeTab]);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL);
      socketRef.current.emit("login", myUserId);
    }
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [myUserId]);

  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('newMessage', (msg) => {
      if (
        selectedUser && (
          (typeof msg.from === "object" ? msg.from._id : msg.from) === selectedUser._id ||
          (typeof msg.to === "object" ? msg.to._id : msg.to) === selectedUser._id
        )
      ) {
        setMessages(prev => [...prev, msg]);
      }
      getUnreadCounts().then(arr => {
        const map = {};
        arr.forEach(({ userId, count }) => { map[userId] = count; });
        setUnreadMap(map);
      });
    });
    return () => {
      socketRef.current.off('newMessage');
    };
  }, [selectedUser, friends]);

  async function loadFriendsAndRequests() {
    setLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getFriends(),
        getFriendRequests()
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFriendsAndRequests(); }, []);

  useEffect(() => {
    if (mainSearch.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    let ignore = false;
    setLoading(true);
    searchUsers(mainSearch).then(results => {
      if (!ignore) setSearchResults(results);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { ignore = true; };
  }, [mainSearch, friends]);

  useEffect(() => {
    if (selectedUser && selectedUser._id) {
      getMessages(selectedUser._id).then(msgs => setMessages(msgs));
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedUser]);

  const userMap = {};
  friends.forEach(u => { userMap[u._id] = u; });
  if (selectedUser && selectedUser._id) userMap[selectedUser._id] = selectedUser;
  if (myUserId && myProfileImage && myUsername) {
    userMap[myUserId] = { profileImage: myProfileImage, username: myUsername };
  }
  messages.forEach(msg => {
    const fromId = typeof msg.from === "object" ? msg.from._id : msg.from;
    if (fromId && !userMap[fromId]) {
      userMap[fromId] = { username: "Unknown", profileImage: "/default-avatar.png" };
    }
  });

  const visibleMessages = messageSearch
    ? messages.filter(msg =>
        msg.text && msg.text.toLowerCase().includes(messageSearch.toLowerCase()))
    : messages;

  const allChatUsers = [
    ...friends.map(u => ({ ...u, isFriend: true })),
    ...messagedUsers.map(u => ({ ...u, isFriend: false })),
    ...outgoingMessagedUsers.map(u => ({ ...u, isFriend: false })),
    ...backendChatUsers.map(u => ({ ...u, isFriend: false }))
  ];
  const chatUserMap = {};
  allChatUsers.forEach(u => { chatUserMap[u._id] = u; });
  const sortedChatUsers = Object.values(chatUserMap).sort((a, b) => {
    const aLast = a.lastMessageAt;
    const bLast = b.lastMessageAt;
    if (aLast && bLast) return new Date(bLast) - new Date(aLast);
    if (aLast) return -1;
    if (bLast) return 1;
    return (a.username || "").localeCompare(b.username || "");
  });

  const messageRequestIds = new Set(messageRequests.map(u => u._id));
  const filteredChatUsers = sortedChatUsers.filter(
    u => !messageRequestIds.has(u._id)
  );

  const isMessageRequest = selectedUser && messageRequests.some(u => u._id === selectedUser._id);

  async function handleAcceptMessageRequest(fromId) {
    await fetch(`http://localhost:5000/api/messages/accept-message-request/${fromId}`, {
      method: 'POST',
      credentials: 'include'
    });
    setMessageRequests(msgReqs => msgReqs.filter(u => u._id !== fromId));
    if (selectedUser && selectedUser._id === fromId) {
      setSelectedUser(null);
    }
  }
  async function handleDeclineMessageRequest(fromId) {
    await fetch(`http://localhost:5000/api/messages/decline-message-request/${fromId}`, {
      method: 'POST',
      credentials: 'include'
    });
    setMessageRequests(msgReqs => msgReqs.filter(u => u._id !== fromId));
    setSelectedUser(null);
  }

  async function handleDelete(msgId) {
    await fetch(`http://localhost:5000/api/messages/${msgId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (selectedUser && selectedUser._id) {
      setMessages(await getMessages(selectedUser._id));
    }
  }

  async function handleEdit(msgId, newText) {
    await editMessage(msgId, newText);
    setEditingMsgId(null);
    setEditText('');
    if (selectedUser && selectedUser._id) {
      setMessages(await getMessages(selectedUser._id));
    }
  }

  function getProfileImageSrc(user) {
    if (!user) return '/default-avatar.png';
    if (user.profileImage) {
      if (user.profileImage.startsWith('http')) return user.profileImage;
      if (user.profileImage.startsWith('/uploads')) return 'http://localhost:5000' + user.profileImage;
      if (user.profileImage.startsWith('/')) return user.profileImage;
      return '/' + user.profileImage;
    }
    return '/default-avatar.png';
  }

  function handleUserSelect(user) {
    setSelectedUser(user);
    setMainSearch('');
    setSearchResults([]);
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUser?._id) return;
    await sendMessage(selectedUser._id, messageInput);
    socketRef.current.emit('sendMessage', {
      from: myUserId,
      to: selectedUser._id,
      text: messageInput
    });
    setMessageInput('');
    const updated = await getMessages(selectedUser._id);
    setMessages(updated);
    const recipientId = selectedUser._id;
    const isAlreadyInChats =
      friends.some(f => f._id === recipientId) ||
      messagedUsers.some(u => u._id === recipientId) ||
      outgoingMessagedUsers.some(u => u._id === recipientId) ||
      backendChatUsers.some(u => u._id === recipientId);
    if (!isAlreadyInChats) {
      setOutgoingMessagedUsers(prev => [
        ...prev,
        {
          ...selectedUser,
          _id: recipientId,
          lastMessageAt: new Date().toISOString(),
          isFriend: false
        }
      ]);
    }
  };

  if (!open) {
    return (
      <button
        style={{
          position: "fixed", bottom: 28, right: 28,
          background: "linear-gradient(135deg,#ffe066 70%,#b89b37 120%)",
          color: "#191919", border: "2px solid #baa30b", borderRadius: "50%",
          width: 54, height: 54, boxShadow: "0 6px 24px #0005",
          fontSize: 26, fontWeight: 800, zIndex: 1050, cursor: "pointer"
        }}
        onClick={() => setOpen(true)}
        aria-label="Open chat"
      >
        <FaCommentDots style={{ color: "#191919" }} />
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1100,
      width: 430, maxWidth: "99vw", height: 540,
      background: "#101014", borderRadius: 16, boxShadow: "0 16px 72px #000b, 0 1.5px 14px #ffe06610",
      display: "flex", flexDirection: "column", overflow: "hidden", border: "2.2px solid #ffe06635"
    }}>
      <ChatHeader
        onClose={() => setOpen(false)}
        onThemeToggle={() => {/* Theme logic here */}}
        showBack={!!selectedUser}
        onBack={() => { setSelectedUser(null); setMainSearch(''); setSearchResults([]); }}
        selectedUser={selectedUser}
      />

      {!selectedUser ? (
        <>
          <div style={{
            background: "#16161b", display: "flex", borderBottom: "2px solid #242426",
            boxShadow: "0 3px 12px #ffe0660a"
          }}>
            {['chats', 'groups', 'requests'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '14px 0 13px 0',
                  background: activeTab === tab ? "#ffe066" : "none",
                  color: activeTab === tab ? "#191900" : "#ffe066",
                  fontWeight: 900, fontSize: 18,
                  border: 'none', borderBottom: activeTab === tab ? '4px solid #ffe066' : '4px solid transparent',
                  cursor: 'pointer', letterSpacing: 0.4, outline: 'none'
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div style={{
            padding: "15px 20px 13px 20px",
            borderBottom: "1px solid #242426", background: "#18181b"
          }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <FaSearch style={{
                color: "#ffe066a0",
                fontSize: 17,
                position: "absolute",
                left: 15,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2
              }} />
              <input
                type="text"
                placeholder={`Search users`}
                value={mainSearch}
                onChange={e => setMainSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 13px 10px 41px",
                  borderRadius: 10,
                  border: "none",
                  background: "#141417",
                  color: "#ffe066",
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: "0 1px 6px #ffe06610",
                  outline: "none"
                }}
              />
            </div>
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            background: "#101014"
          }}>
            {activeTab === 'chats' && filteredChatUsers.map(user =>
              <UserListItem
                key={user._id}
                user={user}
                isFriend={user.isFriend}
                selected={selectedUser && selectedUser._id === user._id}
                onClick={() => handleUserSelect(user)}
                unreadCount={unreadMap[user._id] || 0}
              />
            )}
            {activeTab === 'chats' && mainSearch && searchResults
              .filter(u => !filteredChatUsers.some(f => f._id === u._id))
              .map(user =>
                <UserListItem
                  key={user._id}
                  user={user}
                  isFriend={false}
                  selected={selectedUser && selectedUser._id === user._id}
                  onClick={() => handleUserSelect(user)}
                  requestMsg="Send friend request"
                />
              )
            }
            {activeTab === 'requests' && (
              <div style={{ margin: 10 }}>
                {messageRequests.length === 0
                  ? <div style={{ color: "#ffe06688", fontWeight: 700, fontSize: 17, marginTop: 20 }}>No message requests yet.</div>
                  : messageRequests.map(u => (
                    <div
                      key={u._id}
                      onClick={() => handleUserSelect(u)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: "#18181b",
                        borderRadius: 9,
                        marginBottom: 12,
                        padding: "10px 14px",
                        cursor: "pointer"
                      }}>
                      <img src={getProfileImageSrc(u)}
                        alt="profile"
                        style={{ width: 38, height: 38, borderRadius: 19, marginRight: 13, objectFit: 'cover', border: '2px solid #ffe066' }} />
                      <span style={{ flex: 1, fontWeight: 700, color: '#ffe066', fontSize: 17 }}>
                        @{u.username || u.fullName}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {isMessageRequest && (
            <div style={{ padding: 18, background: "#18181b", borderBottom: "2px solid #333" }}>
              <span style={{ fontWeight: 700, color: "#ffe066", fontSize: 17 }}>
                @{selectedUser.username || selectedUser.fullName} sent you a message request
              </span>
              <div style={{ marginTop: 12 }}>
                <button
                  style={{
                    background: '#ffe066', color: '#101014', fontWeight: 800, border: 'none',
                    borderRadius: 7, padding: '6px 17px', fontSize: 16, marginRight: 8, cursor: 'pointer'
                  }}
                  onClick={() => handleAcceptMessageRequest(selectedUser._id)}
                >Accept</button>
                <button
                  style={{
                    background: '#18181b', color: '#ffe066', fontWeight: 800, border: '1.5px solid #ffe066',
                    borderRadius: 7, padding: '6px 17px', fontSize: 16, cursor: 'pointer'
                  }}
                  onClick={() => handleDeclineMessageRequest(selectedUser._id)}
                >Decline</button>
              </div>
            </div>
          )}
          <div style={{
            flex: 1,
            overflowY: "auto",
            background: "#101014",
            display: "flex",
            flexDirection: "column",
            padding: "23px 24px 0 24px",
            minHeight: 0
          }}>
            <MessageList
              messages={visibleMessages}
              myUserId={myUserId}
              myUsername={myUsername}
              userMap={userMap}
              editingMsgId={editingMsgId}
              editText={editText}
              onEditClick={(id, text) => { setEditingMsgId(id); setEditText(text); }}
              onDelete={handleDelete}
              onEditSave={handleEdit}
              onEditCancel={() => setEditingMsgId(null)}
              onEditTextChange={e => setEditText(e.target.value)}
              onReact={() => {}}
            />
            <div ref={messagesEndRef} />
          </div>
          <ChatInputBar
            messageInput={messageInput}
            setMessageInput={setMessageInput}
            onSend={handleSendMessage}
          />
        </>
      )}
    </div>
  );
});

export default ChatBox;
