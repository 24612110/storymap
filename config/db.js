const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://dinhbao01012006:78oo4flWd0ZfAblk@cluster0.pw5mn.mongodb.net/storymapjs', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('Kết nối MongoDB thành công!');
    } catch (err) {
        console.error('Kết nối MongoDB thất bại:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
