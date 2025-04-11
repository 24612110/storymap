const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const path = require('path');
const axios = require('axios'); 
const ensureAdminAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  req.session.error = 'Admin access required';
  res.redirect('/auth/login');
};
router.get('/', ensureAdminAuthenticated, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const pendingCount = await Post.countDocuments({ isPending: true });
    const approvedCount = postCount - pendingCount;
    const recentPosts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('author', 'username');
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thisMonth } });
    const newPostsThisMonth = await Post.countDocuments({ createdAt: { $gte: thisMonth } });
    
    const mapPosts = await Post.find({ 
      'location.coordinates': { $exists: true, $ne: [] } 
    }).select('title location isPending author').populate('author', 'username');
    
    const updateCountryData = async () => {
      const postsWithoutCountry = await Post.find({
        'location.coordinates': { $exists: true, $ne: [] },
        $or: [{ country: { $exists: false } }, { country: null }]
      }).limit(10);
      
      for (const post of postsWithoutCountry) {
        try {
          if (post.location && post.location.coordinates && post.location.coordinates.length >= 2) {
            const lng = post.location.coordinates[0];
            const lat = post.location.coordinates[1];
            const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
              params: {
                format: 'json',
                lat: lat,
                lon: lng,
                zoom: 3
              },
              headers: {
                'User-Agent': 'StoryMapApp/1.0'
              }
            });
            
            const data = response.data;
            
            if (data.address && data.address.country) {
              post.country = data.address.country;
              post.countryCode = data.address.country_code?.toUpperCase() || '';
              await post.save();
              console.log(`Updated country for post ${post._id} to ${post.country}`);
            }
          }
        } catch (error) {
          console.error(`Error updating country for post ${post._id}:`, error.message);
        }
      }
    };
    try {
      await updateCountryData();
    } catch (error) {
      console.error('Error updating post country data:', error);
    }
    const countryAggregation = await Post.aggregate([
      {
        $match: { 
          country: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: { 
            country: '$country', 
            countryCode: '$countryCode' 
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          country: '$_id.country',
          countryCode: '$_id.countryCode',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);
    let topCountriesData = countryAggregation.length > 0 ? countryAggregation : [
      { country: 'Việt Nam', countryCode: 'VN', count: 156 },
      { country: 'Hoa Kỳ', countryCode: 'US', count: 95 },
      { country: 'Nhật Bản', countryCode: 'JP', count: 78 },
      { country: 'Pháp', countryCode: 'FR', count: 65 },
      { country: 'Hàn Quốc', countryCode: 'KR', count: 52 },
      { country: 'Anh', countryCode: 'GB', count: 48 },
      { country: 'Ý', countryCode: 'IT', count: 35 },
      { country: 'Đức', countryCode: 'DE', count: 29 },
      { country: 'Singapore', countryCode: 'SG', count: 21 },
      { country: 'Úc', countryCode: 'AU', count: 15 }
    ];
    const totalPostsInTop10 = topCountriesData.reduce((sum, country) => sum + country.count, 0);
    const topCountries = topCountriesData.map(country => ({
      code: country.countryCode?.toLowerCase() || '',
      name: country.country,
      count: country.count,
      percentage: Math.round((country.count / totalPostsInTop10) * 100)
    }));

    res.render('admin/dashboard', {
      layout: 'layouts/admin',
      title: 'Bảng điều khiển',
      activeRoute: 'dashboard',
      stats: {
        userCount,
        postCount,
        pendingCount,
        approvedCount,
        newUsersThisMonth,
        newPostsThisMonth
      },
      recentPosts,
      mapPosts: JSON.stringify(mapPosts),
      topCountries,
      jsonTopCountries: JSON.stringify(topCountries)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.session.error = 'Không thể tải dữ liệu bảng điều khiển';
    res.render('admin/dashboard', {
      layout: 'layouts/admin',
      title: 'Bảng điều khiển',
      activeRoute: 'dashboard',
      stats: {
        userCount: 0,
        postCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        newUsersThisMonth: 0,
        newPostsThisMonth: 0
      }
    });
  }
});
router.get('/users', ensureAdminAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    
    // Build search query
    const searchQuery = search 
      ? { username: { $regex: search, $options: 'i' } } 
      : {};
    const totalUsers = await User.countDocuments(searchQuery);
    const users = await User.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const usersWithCounts = await Promise.all(users.map(async (user) => {
      const postCount = await Post.countDocuments({ author: user._id });
      return {
        ...user.toObject(),
        postCount,
        isActive: user.isActive !== false 
      };
    }));
    const totalPages = Math.ceil(totalUsers / limit);
    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;
    const pages = [];
    const pageWindow = 2; 
    
    for (let i = Math.max(1, page - pageWindow); i <= Math.min(totalPages, page + pageWindow); i++) {
      pages.push({
        pageNumber: i,
        isCurrentPage: i === page
      });
    }
    
    res.render('admin/users', {
      layout: 'layouts/admin',
      title: 'Quản lý người dùng',
      activeRoute: 'users',
      users: usersWithCounts,
      search,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalUsers,
        hasPrevPage,
        hasNextPage,
        prevPage: page - 1,
        nextPage: page + 1,
        startIndex: skip + 1,
        endIndex: Math.min(skip + limit, totalUsers),
        pages
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    req.session.error = 'Không thể tải dữ liệu người dùng';
    res.redirect('/admin');
  }
});

router.get('/users/:id', ensureAdminAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Có lỗi xảy ra khi tải dữ liệu người dùng' });
  }
});

router.get('/users/:id/details', ensureAdminAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }
    
    const postCount = await Post.countDocuments({ author: user._id });
    const approvedPostCount = await Post.countDocuments({ author: user._id, isPending: false });
    const pendingPostCount = await Post.countDocuments({ author: user._id, isPending: true });
    
    const recentPosts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    const userData = {
      ...user.toObject(),
      isActive: user.isActive !== false,
      postCount,
      approvedPostCount,
      pendingPostCount,
      recentPosts
    };
    
    res.json({ success: true, user: userData });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, error: 'Có lỗi xảy ra khi tải dữ liệu chi tiết người dùng' });
  }
});

router.post('/users/create', ensureAdminAuthenticated, async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      req.session.error = 'Tên người dùng đã tồn tại';
      return res.redirect('/admin/users');
    }
    
    const newUser = new User({
      username,
      password,
      isAdmin: !!isAdmin,
      isActive: true
    });
    
    await newUser.save();
    
    req.session.success = 'Người dùng đã được tạo thành công';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error creating user:', error);
    req.session.error = 'Có lỗi xảy ra khi tạo người dùng';
    res.redirect('/admin/users');
  }
});

router.post('/users/update', ensureAdminAuthenticated, async (req, res) => {
  try {
    const { userId, username, password, isAdmin } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      req.session.error = 'Không tìm thấy người dùng';
      return res.redirect('/admin/users');
    }
    
    if (username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        req.session.error = 'Tên người dùng đã tồn tại';
        return res.redirect('/admin/users');
      }
    }
    
    user.username = username;
    if (password) {
      user.password = password;
    }
    user.isAdmin = !!isAdmin;
    
    await user.save();
    
    req.session.success = 'Người dùng đã được cập nhật thành công';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user:', error);
    req.session.error = 'Có lỗi xảy ra khi cập nhật người dùng';
    res.redirect('/admin/users');
  }
});
router.post('/users/:id/status', ensureAdminAuthenticated, async (req, res) => {
  try {
    const { action } = req.body;
    
    if (action !== 'activate' && action !== 'deactivate') {
      return res.status(400).json({ success: false, error: 'Hành động không hợp lệ' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });
    }
    
    if (user._id.toString() === req.user._id.toString() && action === 'deactivate') {
      return res.status(400).json({ success: false, error: 'Bạn không thể vô hiệu hóa tài khoản của chính mình' });
    }
    
    user.isActive = action === 'activate';
    await user.save();
    
    res.json({ success: true, message: `Người dùng đã được ${action === 'activate' ? 'kích hoạt' : 'vô hiệu hóa'} thành công` });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ success: false, error: 'Có lỗi xảy ra khi thay đổi trạng thái người dùng' });
  }
});

router.post('/users/delete', ensureAdminAuthenticated, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (userId === req.user._id.toString()) {
      req.session.error = 'Bạn không thể xóa tài khoản của chính mình';
      return res.redirect('/admin/users');
    }
    
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      req.session.error = 'Không tìm thấy người dùng';
      return res.redirect('/admin/users');
    }
    
    await Post.deleteMany({ author: userId });
    
    req.session.success = 'Người dùng và tất cả bài đăng của họ đã được xóa thành công';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    req.session.error = 'Có lỗi xảy ra khi xóa người dùng';
    res.redirect('/admin/users');
  }
});

router.get('/posts', ensureAdminAuthenticated, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username').sort({ createdAt: -1 });
    const pendingPosts = posts.filter(post => post.isPending);
    const approvedPosts = posts.filter(post => !post.isPending);
    
    res.render('admin/posts', {
      layout: 'layouts/admin',
      title: 'Post Management',
      activeRoute: 'posts',
      pendingPosts,
      approvedPosts,
      pendingCount: pendingPosts.length
    });
  } catch (error) {
    console.error(error);
    req.session.error = 'Failed to load posts';
    res.redirect('/admin');
  }
});

router.get('/posts/:id', ensureAdminAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'username');
    
    if (!post) {
      return res.status(404).json({ success: false, error: 'Bài đăng không tồn tại' });
    }
    
    res.json({ 
      success: true, 
      post: {
        _id: post._id,
        title: post.title,
        content: post.content,
        author: post.author,
        image: post.image,
        isPending: post.isPending,
        createdAt: post.createdAt,
        location: post.location,
        rejectionReason: post.rejectionReason
      } 
    });
  } catch (error) {
    console.error('Error fetching post details:', error);
    res.status(500).json({ success: false, error: 'Có lỗi xảy ra khi tải chi tiết bài đăng' });
  }
});

router.post('/posts/:id/approve', ensureAdminAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    post.isPending = false;
    post.rejectionReason = undefined;
    await post.save();
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Post approved successfully' });
    }
    
    req.session.success = 'Post approved successfully';
    res.redirect('/admin/posts');
  } catch (error) {
    console.error(error);
    
    if (req.xhr) {
      return res.status(500).json({ error: 'Failed to approve post' });
    }
    
    req.session.error = 'Failed to approve post';
    res.redirect('/admin/posts');
  }
});

router.post('/posts/:id/reject', ensureAdminAuthenticated, async (req, res) => {
  try {
    const postId = req.params.id;
    const { reason } = req.body;
    
    // Basic validation
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp lý do từ chối bài đăng'
      });
    }
    
    // Find the post
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy bài đăng'
      });
    }
    
    // Delete the post or mark it as rejected (depending on your application logic)
    // Option 1: Delete the post
    await Post.findByIdAndDelete(postId);
    
    // Option 2: Mark as rejected (if you want to keep a record)
    // post.isPending = false;
    // post.isRejected = true;
    // post.rejectionReason = reason;
    // post.rejectedAt = new Date();
    // post.rejectedBy = req.user._id;
    // await post.save();
    
    // Send notification to the author (if you have a notification system)
    // This is just a placeholder for where you could add notification logic
    
    res.json({
      success: true,
      message: 'Bài đăng đã bị từ chối thành công',
      reason
    });
  } catch (error) {
    console.error('Error rejecting post:', error);
    res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi từ chối bài đăng'
    });
  }
});

router.post('/posts/:id/delete', ensureAdminAuthenticated, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    
    if (req.xhr) {
      return res.json({ success: true, message: 'Post deleted successfully' });
    }
    
    req.session.success = 'Post deleted successfully';
    res.redirect('/admin/posts');
  } catch (error) {
    console.error(error);
    
    if (req.xhr) {
      return res.status(500).json({ error: 'Failed to delete post' });
    }
    
    req.session.error = 'Failed to delete post';
    res.redirect('/admin/posts');
  }
});
router.get('/export/users', ensureAdminAuthenticated, async (req, res) => {
  try {
    const format = req.query.format || 'excel';
    const users = await User.find().sort({ createdAt: -1 });
    const usersWithCounts = await Promise.all(users.map(async (user) => {
      const postCount = await Post.countDocuments({ author: user._id });
      const approvedPostCount = await Post.countDocuments({ author: user._id, isPending: false });
      const pendingPostCount = await Post.countDocuments({ author: user._id, isPending: true });
      
      return {
        ID: user._id.toString(),
        Username: user.username,
        IsAdmin: user.isAdmin ? 'Có' : 'Không',
        IsActive: user.isActive !== false ? 'Hoạt động' : 'Khóa',
        CreatedAt: user.createdAt.toLocaleString('vi-VN'),
        TotalPosts: postCount,
        ApprovedPosts: approvedPostCount,
        PendingPosts: pendingPostCount
      };
    }));
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `users_export_${dateStr}`;
    
    if (format === 'csv') {
      // CSV export
      const fields = ['ID', 'Username', 'IsAdmin', 'IsActive', 'CreatedAt', 'TotalPosts', 'ApprovedPosts', 'PendingPosts'];
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(usersWithCounts);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
      return res.send(csv);
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Users');
      
      worksheet.columns = [
        { header: 'ID', key: 'ID', width: 25 },
        { header: 'Tên người dùng', key: 'Username', width: 20 },
        { header: 'Quản trị viên', key: 'IsAdmin', width: 15 },
        { header: 'Trạng thái', key: 'IsActive', width: 15 },
        { header: 'Ngày tạo', key: 'CreatedAt', width: 20 },
        { header: 'Tổng số bài đăng', key: 'TotalPosts', width: 18 },
        { header: 'Bài đăng đã duyệt', key: 'ApprovedPosts', width: 18 },
        { header: 'Bài đăng chờ duyệt', key: 'PendingPosts', width: 18 }
      ];
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9F1FD' }
      };
      
      worksheet.addRows(usersWithCounts);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
      
      await workbook.xlsx.write(res);
      return res.end();
    }
  } catch (error) {
    console.error('Error exporting users:', error);
    req.session.error = 'Có lỗi xảy ra khi xuất dữ liệu người dùng';
    return res.redirect('/admin');
  }
});

router.get('/export/posts', ensureAdminAuthenticated, async (req, res) => {
  try {
    const format = req.query.format || 'excel';
    
    const posts = await Post.find().sort({ createdAt: -1 }).populate('author', 'username');
    
    const postsData = posts.map(post => {
      return {
        ID: post._id.toString(),
        Title: post.title,
        Content: post.content,
        Author: post.author ? post.author.username : 'Unknown',
        Status: post.isPending ? 'Chờ duyệt' : 'Đã duyệt',
        HasImage: post.image ? 'Có' : 'Không',
        Latitude: post.location?.coordinates[1] || '',
        Longitude: post.location?.coordinates[0] || '',
        CreatedAt: post.createdAt.toLocaleString('vi-VN'),
      };
    });
    
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `posts_export_${dateStr}`;
    
    if (format === 'csv') {
      const fields = ['ID', 'Title', 'Content', 'Author', 'Status', 'HasImage', 'Latitude', 'Longitude', 'CreatedAt'];
      const opts = { fields };
      const parser = new Parser(opts);
      const csv = parser.parse(postsData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.csv`);
      return res.send(csv);
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Posts');
      
      worksheet.columns = [
        { header: 'ID', key: 'ID', width: 25 },
        { header: 'Tiêu đề', key: 'Title', width: 30 },
        { header: 'Nội dung', key: 'Content', width: 50 },
        { header: 'Tác giả', key: 'Author', width: 15 },
        { header: 'Trạng thái', key: 'Status', width: 15 },
        { header: 'Có hình ảnh', key: 'HasImage', width: 15 },
        { header: 'Vĩ độ', key: 'Latitude', width: 15 },
        { header: 'Kinh độ', key: 'Longitude', width: 15 },
        { header: 'Ngày tạo', key: 'CreatedAt', width: 20 }
      ];
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9F1FD' }
      };
      
      worksheet.addRows(postsData);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
      
      await workbook.xlsx.write(res);
      return res.end();
    }
  } catch (error) {
    console.error('Error exporting posts:', error);
    req.session.error = 'Có lỗi xảy ra khi xuất dữ liệu bài đăng';
    return res.redirect('/admin');
  }
});

router.get('/export/report', ensureAdminAuthenticated, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const pendingCount = await Post.countDocuments({ isPending: true });
    const approvedCount = postCount - pendingCount;
    
    const monthlyStats = [];
    
    for (let i = 0; i < 6; i++) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - i);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(0, 0, 0, 0);
      
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 1);
      
      const usersInMonth = await User.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      const postsInMonth = await Post.countDocuments({
        createdAt: { $gte: startDate, $lt: endDate }
      });
      
      monthlyStats.push({
        Month: `${startDate.getMonth() + 1}/${startDate.getFullYear()}`,
        NewUsers: usersInMonth,
        NewPosts: postsInMonth
      });
    }
    
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `statistics_report_${dateStr}`;
    
    const workbook = new ExcelJS.Workbook();
    
    const generalStats = workbook.addWorksheet('Thống kê chung');
    
    generalStats.getCell('A1').value = 'BÁO CÁO THỐNG KÊ HỆ THỐNG';
    generalStats.getCell('A1').font = { size: 16, bold: true };
    generalStats.mergeCells('A1:D1');
    generalStats.getCell('A1').alignment = { horizontal: 'center' };
    
    generalStats.getCell('A3').value = 'Ngày tạo báo cáo:';
    generalStats.getCell('B3').value = now.toLocaleDateString('vi-VN');
    
    generalStats.getCell('A5').value = 'Thống kê chung';
    generalStats.getCell('A5').font = { size: 14, bold: true };
    generalStats.mergeCells('A5:D5');
    
    generalStats.getCell('A7').value = 'Tổng số người dùng:';
    generalStats.getCell('B7').value = userCount;
    
    generalStats.getCell('A8').value = 'Tổng số bài đăng:';
    generalStats.getCell('B8').value = postCount;
    
    generalStats.getCell('A9').value = 'Bài đăng chờ duyệt:';
    generalStats.getCell('B9').value = pendingCount;
    
    generalStats.getCell('A10').value = 'Bài đăng đã duyệt:';
    generalStats.getCell('B10').value = approvedCount;
    
    const monthlyStatsSheet = workbook.addWorksheet('Thống kê theo tháng');
    
    monthlyStatsSheet.columns = [
      { header: 'Tháng', key: 'Month', width: 15 },
      { header: 'Người dùng mới', key: 'NewUsers', width: 20 },
      { header: 'Bài đăng mới', key: 'NewPosts', width: 20 }
    ];
    
    monthlyStatsSheet.getRow(1).font = { bold: true };
    monthlyStatsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE9F1FD' }
    };
    
    monthlyStatsSheet.addRows(monthlyStats);
    
    const chartSheet = workbook.addWorksheet('Biểu đồ');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}.xlsx`);
    
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('Error exporting report:', error);
    req.session.error = 'Có lỗi xảy ra khi xuất báo cáo thống kê';
    return res.redirect('/admin');
  }
});

router.get('/settings', ensureAdminAuthenticated, (req, res) => {
  res.render('admin/settings', {
    layout: 'layouts/admin',
    title: 'Admin Settings',
    activeRoute: 'settings'
  });
});

module.exports = router;
