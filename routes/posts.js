const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Post = require('../models/Post');

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const query = req.user.isAdmin ? {} : { isPending: false };
    
    const posts = await Post.find(query).populate('author', 'username');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.post('/create', ensureAuthenticated, upload.single('image'), async (req, res) => {
  try {
    const { title, content, lat, lng } = req.body;
    
    if (!title || !content || !lat || !lng) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Tọa độ không hợp lệ' });
    }
    
    let country = null;
    let countryCode = null;
    
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude,
          zoom: 3
        },
        headers: {
          'User-Agent': 'StoryMapApp/1.0'
        }
      });
      
      const data = response.data;
      
      if (data.address && data.address.country) {
        country = data.address.country;
        countryCode = data.address.country_code?.toUpperCase() || '';
      }
    } catch (error) {
      console.error('Error fetching country data:', error.message);
    }
    
    const newPost = new Post({
      title,
      content,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      country,
      countryCode,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      author: req.user._id,
      isPending: true
    });
    
    await newPost.save();
    
    res.status(201).json({
      success: true,
      message: 'Câu chuyện của bạn đã được gửi và đang chờ duyệt',
      post: {
        _id: newPost._id,
        title: newPost.title,
        location: newPost.location
      }
    });
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Không thể tạo bài đăng' });
  }
});

router.get('/search', ensureAuthenticated, async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; 
    
    const posts = await Post.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).populate('author', 'username');
    
    res.json(posts);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search posts' });
  }
});

module.exports = router;
