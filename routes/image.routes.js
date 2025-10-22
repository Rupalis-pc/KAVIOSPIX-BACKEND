const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const Album = require("../models/album.model");
const Image = require("../models/image.model");
const verifyJWT = require("../utils/verifyJWT");
const cloudinary = require("../utils/cloudinary");

// Multer setup → memoryStorage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

//Upload Image to Cloudinary
router.post(
  "/:albumId/images",
  verifyJWT,
  upload.single("file"),
  async (req, res) => {
    try {
      const { albumId } = req.params;
      const { tags = [], person = "", isFavorite = false } = req.body;

      // Check existing album
      const album = await Album.findOne({ albumId });
      if (!album) return res.status(404).json({ message: "Album not found" });

      // Check access: only owner or shared user
      if (
        album.ownerId !== req.user.userId &&
        !album.sharedUsers.includes(req.user.email)
      ) {
        return res
          .status(403)
          .json({ message: "You do not have access to this album" });
      }

      if (!req.file)
        return res.status(400).json({ message: "No image file uploaded" });

      // Upload to Cloudinary using stream
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: `albums/${albumId}` },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req.file.buffer);

      // Save metadata to MongoDB
      const newImage = new Image({
        albumId,
        name: result.public_id, // Cloudinary public_id
        url: result.secure_url,
        tags: Array.isArray(tags) ? tags : [tags],
        person,
        isFavorite: Boolean(isFavorite),
        size: req.file.size,
        uploadedAt: new Date(),
        comments: [], // initialize empty array
      });

      await newImage.save();
      res
        .status(201)
        .json({ message: "Image uploaded successfully", image: newImage });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  }
);

// Star (Favorite) Image
router.put(
  "/:albumId/images/:imageId/favorite",
  verifyJWT,
  async (req, res) => {
    try {
      const { albumId, imageId } = req.params;
      const { isFavorite } = req.body;

      // Check album exists
      const album = await Album.findOne({ albumId });
      if (!album) return res.status(404).json({ message: "Album not found" });

      // Check access: owner or shared user
      if (
        album.ownerId !== req.user.userId &&
        !album.sharedUsers.includes(req.user.email)
      ) {
        return res
          .status(403)
          .json({ message: "You do not have access to this album" });
      }

      // Find the image
      const image = await Image.findOne({ _id: imageId, albumId });
      if (!image)
        return res
          .status(404)
          .json({ message: "Image not found in this album" });

      image.isFavorite = isFavorite;
      await image.save();

      res.status(200).json({
        message: `Image has been ${
          isFavorite ? "marked as favorite" : "removed from favorites"
        }`,
        image,
      });
    } catch (error) {
      console.error("Favorite update error:", error);
      res.status(500).json({ message: "Failed to update favorite status" });
    }
  }
);

// Add Comment to Image
router.post(
  "/:albumId/images/:imageId/comments",
  verifyJWT,
  async (req, res) => {
    try {
      const { albumId, imageId } = req.params;
      const { comment } = req.body;

      if (!comment || typeof comment !== "string") {
        return res
          .status(400)
          .json({ message: "Comment must be a valid string" });
      }

      // Check album
      const album = await Album.findOne({ albumId });
      if (!album) return res.status(404).json({ message: "Album not found" });

      // Access check
      if (
        album.ownerId !== req.user.userId &&
        !album.sharedUsers.includes(req.user.email)
      ) {
        return res
          .status(403)
          .json({ message: "You do not have access to this album" });
      }

      // Find image
      const image = await Image.findOne({ _id: imageId, albumId });
      if (!image)
        return res
          .status(404)
          .json({ message: "Image not found in this album" });

      // Add comment
      image.comments.push(comment);
      await image.save();

      res.status(201).json({
        message: "Comment added successfully",
        image,
      });
    } catch (error) {
      console.error("Add comment error:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  }
);

// Delete image
router.delete("/:albumId/images/:imageId", verifyJWT, async (req, res) => {
  try {
    const { albumId, imageId } = req.params;

    const album = await Album.findOne({ albumId });
    if (!album) return res.status(404).json({ message: "Album not found" });

    const image = await Image.findOne({ imageId, albumId });
    if (!image) return res.status(404).json({ message: "Image not found" });

    // Only owner can delete
    if (album.ownerId !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete image" });
    }

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(image.name);

    await Image.deleteOne({ imageId });
    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

// Common function to check album access
const checkAlbumAccess = async (albumId, user) => {
  const album = await Album.findOne({ albumId });
  if (!album) return { error: "Album not found" };

  const hasAccess =
    album.ownerId === user.userId || album.sharedUsers.includes(user.email);

  if (!hasAccess) return { error: "You do not have access to this album" };

  return { album };
};

// Get all images in an album (existing)
router.get("/:albumId/images", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;
    const access = await checkAlbumAccess(albumId, req.user);
    if (access.error) return res.status(403).json({ message: access.error });

    const images = await Image.find({ albumId }).select(
      "imageId name tags person isFavorite comments size uploadedAt"
    );

    res.status(200).json(images);
  } catch (error) {
    console.error("Error fetching album images:", error);
    res.status(500).json({ message: "Failed to fetch album images" });
  }
});

// Get favorite images in an album
router.get("/:albumId/images/favorites", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;
    const access = await checkAlbumAccess(albumId, req.user);
    if (access.error) return res.status(403).json({ message: access.error });

    const favoriteImages = await Image.find({
      albumId,
      isFavorite: true,
    }).select("imageId name tags person isFavorite comments size uploadedAt");

    res.status(200).json(favoriteImages);
  } catch (error) {
    console.error("Error fetching favorite images:", error);
    res.status(500).json({ message: "Failed to fetch favorite images" });
  }
});

// Get images by tags (query parameter)
router.get("/:albumId/images/search", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;
    const { tags } = req.query; // e.g. ?tags=sunset,beach
    const access = await checkAlbumAccess(albumId, req.user);
    if (access.error) return res.status(403).json({ message: access.error });

    if (!tags)
      return res
        .status(400)
        .json({ message: "Please provide tag(s) to search" });

    const tagList = tags.split(",").map((tag) => tag.trim().toLowerCase());

    const images = await Image.find({
      albumId,
      tags: { $in: tagList },
    }).select("imageId name tags person isFavorite comments size uploadedAt");

    res.status(200).json(images);
  } catch (error) {
    console.error("Error fetching images by tag:", error);
    res.status(500).json({ message: "Failed to fetch images by tags" });
  }
});

module.exports = router;
