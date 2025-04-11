const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/storymapjs', {
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
