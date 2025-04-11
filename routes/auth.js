const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');

// We need to add body-parser middleware for form data
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// Register user
router.post('/register', async (req, res) => {
  try {
    console.log('Register request body:', req.body); // Debug log
    
    // Check if req.body exists
    if (!req.body) {
      return res.render('register', {
        error: 'No form data received',
        title: 'Register - StoryMap'
      });
    }
    
    const { username, password } = req.body;
    
    // Basic validation
    if (!username || !password) {
      return res.render('register', { 
        error: 'Username and password are required',
        title: 'Register - StoryMap'
      });
    }
    
    if (password.length < 6) {
      return res.render('register', { 
        error: 'Password must be at least 6 characters',
        title: 'Register - StoryMap'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.render('register', { 
        error: 'Username already exists',
        title: 'Register - StoryMap'
      });
    }
    
    // Create new user
    const newUser = new User({ username, password });
    await newUser.save();
    
    // Redirect to login with success message
    req.session.success = 'Registration successful! Please log in.';
    return res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { 
      error: 'Failed to register user: ' + (error.message || 'Unknown error'),
      title: 'Register - StoryMap'
    });
  }
});

// Login user
router.post('/login', function(req, res, next) {
  console.log('Login request body:', req.body); // Debug log
  
  // Check if req.body exists
  if (!req.body) {
    return res.render('login', {
      error: 'No form data received',
      title: 'Login - StoryMap'
    });
  }
  
  // Check for missing credentials
  if (!req.body.username || !req.body.password) {
    return res.render('login', { 
      error: 'Username and password are required',
      title: 'Login - StoryMap'
    });
  }
  
  passport.authenticate('local', function(err, user, info) {
    if (err) { 
      console.error("Auth error:", err);
      return next(err); 
    }
    
    if (!user) {
      return res.render('login', { 
        error: info?.message || 'Invalid username or password',
        title: 'Login - StoryMap'
      });
    }
    
    req.logIn(user, function(err) {
      if (err) { 
        console.error("Login error:", err);
        return next(err); 
      }
      
      // Redirect to the intended page or default to map
      const redirectTo = req.session.returnTo || '/map';
      delete req.session.returnTo;
      return res.redirect(redirectTo);
    });
  })(req, res, next);
});

// Logout user
router.get('/logout', (req, res) => {
  // For Passport 0.5.0 and newer versions - callback-based
  if (req.logout && req.logout.length > 0) {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Successfully logged out
      res.redirect('/');
    });
  } 
  // For older Passport versions
  else if (req.logout) {
    req.logout();
    res.redirect('/');
  } 
  // No logout function available
  else {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.redirect('/');
    });
  }
});

module.exports = router;
