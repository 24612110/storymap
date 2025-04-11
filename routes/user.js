const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');

// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  req.session.error = 'Vui lòng đăng nhập để xem trang này';
  res.redirect('/auth/login');
};

// User profile page
router.get('/profile', ensureAuthenticated, async (req, res) => {
  try {
    // Count user's posts
    const totalPosts = await Post.countDocuments({ author: req.user._id });
    const pendingPosts = await Post.countDocuments({ author: req.user._id, isPending: true });
    const approvedPosts = totalPosts - pendingPosts;

    // Get user's most recent posts
    const recentPosts = await Post.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('user/profile', {
      title: 'Hồ sơ người dùng',
      postStats: {
        total: totalPosts,
        pending: pendingPosts,
        approved: approvedPosts
      },
      recentPosts
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    req.session.error = 'Không thể tải trang hồ sơ';
    res.redirect('/');
  }
});

// Update username
router.post('/update-username', ensureAuthenticated, async (req, res) => {
  try {
    const { newUsername, password } = req.body;

    // Validate input
    if (!newUsername || !password) {
      req.session.error = 'Vui lòng điền đầy đủ thông tin';
      return res.redirect('/user/profile');
    }

    // Check if new username is different from current
    if (newUsername === req.user.username) {
      req.session.error = 'Tên người dùng mới phải khác tên hiện tại';
      return res.redirect('/user/profile');
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      req.session.error = 'Tên người dùng đã tồn tại';
      return res.redirect('/user/profile');
    }

    // Verify password
    const isMatch = await req.user.comparePassword(password);
    if (!isMatch) {
      req.session.error = 'Mật khẩu không đúng';
      return res.redirect('/user/profile');
    }

    // Update username
    req.user.username = newUsername;
    await req.user.save();

    // Set success message and log out user
    req.session.success = 'Tên người dùng đã được cập nhật. Vui lòng đăng nhập lại.';
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/auth/login');
    });
  } catch (error) {
    console.error('Error updating username:', error);
    req.session.error = 'Không thể cập nhật tên người dùng';
    res.redirect('/user/profile');
  }
});

// Update password
router.post('/update-password', ensureAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.session.error = 'Vui lòng điền đầy đủ thông tin';
      return res.redirect('/user/profile');
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      req.session.error = 'Mật khẩu mới không khớp';
      return res.redirect('/user/profile');
    }

    // Check password length
    if (newPassword.length < 6) {
      req.session.error = 'Mật khẩu mới phải có ít nhất 6 ký tự';
      return res.redirect('/user/profile');
    }

    // Verify current password
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      req.session.error = 'Mật khẩu hiện tại không đúng';
      return res.redirect('/user/profile');
    }

    // Update password
    req.user.password = newPassword; // Mongoose will hash through pre-save hook
    await req.user.save();

    // Set success message and log out user
    req.session.success = 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.';
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/auth/login');
    });
  } catch (error) {
    console.error('Error updating password:', error);
    req.session.error = 'Không thể cập nhật mật khẩu';
    res.redirect('/user/profile');
  }
});

module.exports = router;
