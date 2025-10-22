const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const imageSchema = new mongoose.Schema({
  imageId: {
    type: String,
    default: uuidv4,
    unique: true,
  },
  albumId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  person: {
    type: String,
    default: "",
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
  comments: {
    type: [String],
    default: [],
  },
  size: {
    type: Number,
    default: 0,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const Image = mongoose.model("Image", imageSchema);
module.exports = Image;
