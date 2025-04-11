const express = require('express');
const router = express.Router();

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

// Home page route
router.get('/', (req, res) => {
  res.render('index', { 
    title: 'StoryMap - Share Your Stories'
  });
});

// Login page route
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/map');
  }
  
  // Get success message from session if exists
  const success = req.session.success;
  delete req.session.success;
  
  res.render('login', {
    title: 'Login - StoryMap',
    success: success
  });
});

// Register page route
router.get('/register', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/map');
  }
  res.render('register', {
    title: 'Register - StoryMap'
  });
});

// Map page route - protected by authentication
router.get('/map', ensureAuthenticated, (req, res) => {
  res.render('map', { 
    mapPage: true,
    title: 'Map - StoryMap'
  });
});

module.exports = router;
