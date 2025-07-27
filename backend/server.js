const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const recommendedRoutes = require('./routes/recommendedRoutes');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const searchRoutes = require('./routes/searchRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const profileRoutes = require('./routes/profileRoutes');
const socialRoutes = require('./routes/socialRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const postsRoutes = require('./routes/posts');
const userRoutes = require('./routes/userRoutes'); // ✅ Added
const Post = require('./models/Post');
const User = require('./models/User');

const http = require('http');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://netspacezone.net'
    ],
    credentials: true
  }
});

connectDB();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://netspacezone.net'
  ],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/search', searchRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/api/gallery', galleryRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/posts', postsRoutes);
app.use(userRoutes); // ✅ Added
app.use(recommendedRoutes); // Keep last

console.log('DEBUG - MONGO_URI:', process.env.MONGO_URI);

const onlineUsers = new Map();

const sendNotification = async ({ toUserId, type, message, link, fromId }) => {
  try {
    if (!toUserId || !message) return;
    if (String(toUserId) === String(fromId)) return;
    if (type === 'message' || type === 'dm') return;
    if ((type === 'friend_request' || type === 'follow') && String(toUserId) === String(fromId)) return;
    const user = await User.findById(toUserId);
    if (!user) return;

    let actor = null;
    if (fromId) {
      actor = await User.findById(fromId, 'username profileImage');
    }

    const notification = {
      type,
      message,
      link,
      fromId,
      createdAt: new Date(),
      read: false,
      actor: actor ? {
        _id: actor._id,
        username: actor.username,
        profileImage: actor.profileImage,
      } : undefined
    };

    user.notifications.unshift(notification);
    await user.save();

    const toSocket = onlineUsers.get(String(toUserId));
    if (toSocket) {
      io.to(toSocket).emit('newNotification', notification);
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
};

io.on('connection', async (socket) => {
  let userId = null;

  socket.on('login', (id) => {
    userId = id;
    onlineUsers.set(id, socket.id);
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });

  socket.on('sendMessage', (msg) => {
    const toSocket = onlineUsers.get(msg.to);
    if (toSocket) io.to(toSocket).emit('newMessage', msg);
    socket.emit('newMessage', msg);
  });

  socket.on('avatarChange', (data) => {
    io.emit('avatarChange', data);
  });

  try {
    const posts = await Post.find({})
      .sort({ date: -1 })
      .populate('user', 'username profileImage')
      .populate('comments.user', 'username profileImage');
    socket.emit('initialPosts', posts);
  } catch (err) {
    socket.emit('initialPosts', []);
  }

  socket.on('createPost', async (data) => {
    try {
      const { content, image, user, avatar } = data;
      if (!content || !user) return;
      const newPost = new Post({
        content,
        image: image || '',
        user,
        avatar: avatar || '',
        comments: [],
        likes: [],
      });
      await newPost.save();
      const populated = await Post.findById(newPost._id)
        .populate('user', 'username profileImage')
        .populate('comments.user', 'username profileImage');
      io.emit('newPost', populated);
    } catch (err) {
      console.error('Create post error:', err);
      socket.emit('error', { error: 'Failed to create post' });
    }
  });

  socket.on('editPost', async ({ postId, content, image, user }) => {
    try {
      const post = await Post.findById(postId);
      if (!post) return;
      if (!user || String(post.user) !== String(user)) return;
      if (typeof content === 'string') post.content = content;
      if (typeof image === 'string') post.image = image;
      await post.save();
      io.emit('postEdited', { postId, content: post.content, image: post.image });
    } catch (err) {
      console.error('Edit post error:', err);
      socket.emit('error', { error: 'Failed to edit post' });
    }
  });

  socket.on('deletePost', async ({ postId, user }) => {
    try {
      const post = await Post.findById(postId);
      if (!post) return;
      if (!user || String(post.user) !== String(user)) return;
      await Post.findByIdAndDelete(postId);
      io.emit('postDeleted', { postId });
    } catch (err) {
      console.error('Delete post error:', err);
      socket.emit('error', { error: 'Failed to delete post' });
    }
  });

  socket.on('addComment', async ({ postId, text, user, avatar }) => {
    try {
      if (!user || !mongoose.Types.ObjectId.isValid(user)) {
        socket.emit('error', { error: 'Invalid user ID' });
        return;
      }
      const comment = { text, user, avatar, date: new Date(), replies: [] };
      const post = await Post.findByIdAndUpdate(
        postId,
        { $push: { comments: comment } },
        { new: true }
      )
        .populate('user', 'username profileImage')
        .populate('comments.user', 'username profileImage');
      const addedComment = post.comments[post.comments.length - 1];
      io.emit('newComment', { postId, comment: addedComment });
      if (String(post.user) !== String(user)) {
        await sendNotification({
          toUserId: post.user,
          type: 'comment',
          message: `commented: "${text}" on your post`,
          link: `/post/${postId}`,
          fromId: user,
        });
      }
    } catch (err) {
      console.error('Add comment error:', err);
      socket.emit('error', { error: 'Failed to add comment' });
    }
  });

  socket.on('editComment', async ({ postId, commentIndex, text, user }) => {
    try {
      const post = await Post.findById(postId);
      if (!post) return;
      const comment = post.comments[commentIndex];
      if (!comment) return;
      if (!user || String(comment.user) !== String(user)) return;
      comment.text = text;
      await post.save();
      io.emit('commentEdited', { postId, commentIndex, text });
    } catch (err) {
      console.error('Edit comment error:', err);
      socket.emit('error', { error: 'Failed to edit comment' });
    }
  });

  socket.on('deleteComment', async ({ postId, commentIndex, user }) => {
    try {
      const post = await Post.findById(postId);
      if (!post) return;
      const comment = post.comments[commentIndex];
      if (!comment) return;
      if (!user || String(comment.user) !== String(user)) return;
      post.comments.splice(commentIndex, 1);
      await post.save();
      io.emit('commentDeleted', { postId, commentIndex });
    } catch (err) {
      console.error('Delete comment error:', err);
      socket.emit('error', { error: 'Failed to delete comment' });
    }
  });

  socket.on('disconnect', () => {
    if (userId) onlineUsers.delete(userId);
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Upload route active at /api/upload`);
  console.log(`✅ Gallery route active at /api/gallery`);
  console.log(`✅ Social route active at /api/social`);
  console.log(`✅ Notifications route active at /api/notifications`);
  console.log(`✅ Messages route active at /api/messages`);
  console.log(`✅ Posts route active at /api/posts`);
  console.log(`🌐 Socket.io real-time server active!`);
  console.log(`Server running on port ${PORT}`);
});
