const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const path = require('path');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const connectDB = require('./config/db');
const hbs = require('hbs');
const app = express();
require('dotenv').config();
mongoose.set('strictQuery', false);

connectDB();

require('./config/passport');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Handlebars setup
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.set('view options', { layout: 'layouts/main' }); 

hbs.registerPartials(path.join(__dirname, 'views/partials'));

// Handlebars helpers
hbs.registerHelper('if_eq', function(a, b, opts) {
    if (a === b) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

hbs.registerHelper('formatDate', function(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.registerHelper('truncate', function(text, length) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
});

app.use((req, res, next) => {
    res.locals.currentYear = new Date().getFullYear();
    next();
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://code.jquery.com", "'unsafe-inline'"],
            styleSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://unpkg.com", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://nominatim.openstreetmap.org"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use((req, res, next) => {
    res.setHeader("Referrer-Policy", "origin");
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://127.0.0.1:27017/storymapjs',
        collection: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax', 
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

if (app.get('env') === 'production') {
    app.set('trust proxy', 1); 
}

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Make data available to views
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.success = req.session.success;
    res.locals.error = req.session.error;
    res.locals.currentYear = new Date().getFullYear();
    
    // Clear flash messages
    delete req.session.success;
    delete req.session.error;
    
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/posts', require('./routes/posts'));
app.use('/admin', require('./routes/admin'));
app.use('/user', require('./routes/user'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        error: 'Something went wrong',
        title: 'Error'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🪄  Server đang hoạt động tại http://localhost:${PORT}`));