const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number]
    },
    country: { type: String },
    countryCode: { type: String },
    image: { type: String },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPending: { type: Boolean, default: true },
    isRejected: { type: Boolean, default: false },
    rejectionReason: { type: String },
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

PostSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Post', PostSchema);
