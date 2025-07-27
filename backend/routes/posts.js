const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');

// Get all posts (feed)
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find({})
      .sort({ date: -1 })
      .populate('user', 'username profileImage')
      .populate('comments.user', 'username profileImage');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Create a post (unchanged)
router.post('/', async (req, res) => {
  try {
    const { content, image, user, avatar } = req.body;
    if (!content || !user) return res.status(400).json({ error: 'Content and user required' });

    const foundUser = await User.findById(user);
    if (!foundUser) return res.status(400).json({ error: 'Invalid user.' });

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
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
});

// Edit a post (only owner can edit)
router.patch('/:postId', async (req, res) => {
  try {
    const { content, image, user } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!user || String(post.user) !== String(user))
      return res.status(403).json({ error: 'Only post owner can edit' });

    if (typeof content === 'string') post.content = content;
    if (typeof image === 'string') post.image = image;
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

// Delete a post (only owner can delete)
router.delete('/:postId', async (req, res) => {
  try {
    const { user } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!user || String(post.user) !== String(user))
      return res.status(403).json({ error: 'Only post owner can delete' });

    await Post.findByIdAndDelete(req.params.postId);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Add a comment to a post (unchanged)
router.post('/:postId/comment', async (req, res) => {
  try {
    const { text, user, avatar } = req.body;
    if (!text || !user) return res.status(400).json({ error: 'Text and user required' });

    const foundUser = await User.findById(user);
    if (!foundUser) return res.status(400).json({ error: 'Invalid user.' });

    const comment = { text, user, avatar, date: new Date(), replies: [] };
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      { $push: { comments: comment } },
      { new: true }
    )
      .populate('user', 'username profileImage')
      .populate('comments.user', 'username profileImage');
    const addedComment = post.comments[post.comments.length - 1];
    res.status(201).json(addedComment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment', details: err.message });
  }
});

// Edit a comment (only owner can edit)
router.patch('/:postId/comment/:commentIndex', async (req, res) => {
  try {
    const { text, user } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments[req.params.commentIndex];
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (!user || String(comment.user) !== String(user))
      return res.status(403).json({ error: 'Only comment owner can edit' });

    comment.text = text;
    await post.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit comment' });
  }
});

// Delete a comment (only owner can delete)
router.delete('/:postId/comment/:commentIndex', async (req, res) => {
  try {
    const { user } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const comment = post.comments[req.params.commentIndex];
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (!user || String(comment.user) !== String(user))
      return res.status(403).json({ error: 'Only comment owner can delete' });

    post.comments.splice(req.params.commentIndex, 1);
    await post.save();
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
