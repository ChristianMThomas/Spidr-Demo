const mongoose = require('mongoose');

const betaSignupSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  signedUpAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('BetaSignup', betaSignupSchema);
