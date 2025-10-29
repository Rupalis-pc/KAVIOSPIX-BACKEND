const express = require("express");
const router = express.Router();
const Album = require("../models/album.model");
const User = require("../models/user.model");

const verifyJWT = require("../utils/verifyJWT");

router.post("/", verifyJWT, async (req, res) => {
  try {
    const { name, description } = req.body;

    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(400).json({ message: "Missing ownerId from token" });
    }

    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ message: "Album name is required and must be a string." });
    }

    const newAlbum = new Album({
      name,
      description,
      ownerId,
      sharedUsers: [],
    });

    await newAlbum.save();
    res
      .status(201)
      .json({ message: "Album created successfully", album: newAlbum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create album" });
  }
});

router.put("/:albumId", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;
    const { description } = req.body;

    if (description && typeof description !== "string") {
      return res.status(400).json({ message: "Description must be a string." });
    }

    // Find album
    const album = await Album.findOne({ albumId });
    if (!album) {
      return res.status(404).json({ message: "Album not found." });
    }

    if (album.ownerId !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to update this album." });
    }

    if (description !== undefined) {
      album.description = description;
    }

    await album.save();

    res.json({
      message: "Album description updated successfully",
      updatedAlbum: album,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update album" });
  }
});

router.post("/:albumId/share", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;
    const { email } = req.body; 

     console.log("📤 Share album route hit:", albumId);
     console.log("📧 Sharing with:", email);

    if (!email || typeof email !== "string") {
      return res
        .status(400)
        .json({ message: "Email is required and must be a string." });
    }

    // Find album
    const album = await Album.findOne({ albumId });
    if (!album) {
      return res.status(404).json({ message: "Album not found." });
    }

    // Only owner can share
    if (album.ownerId !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to share this album" });
    }

    // Check if user exists in system
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User does not exist in the system." });
    }

    // Add email to sharedUsers if not already there
    if (!album.sharedUsers.includes(email)) {
      album.sharedUsers.push(email);
      await album.save();
    }

    res.json({
      message: "Album shared successfully",
      sharedUsers: album.sharedUsers,
    });
  } catch (error) {
    console.error("Share album error:",error);
    res.status(500).json({ message: "Failed to share album" });
  }
});

// GET ALL ALBUMS
// User can see albums they own or that are shared with them
router.get("/", verifyJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Find all albums where user is owner or shared user
    const albums = await Album.find({
      $or: [{ ownerId: userId }, { sharedUsers: userEmail }],
    }).select("albumId name description ownerId sharedUsers");

    res.status(200).json(albums);
  } catch (error) {
    console.error("Error fetching albums:", error);
    res.status(500).json({ message: "Failed to fetch albums" });
  }
});

//DELETE ALBUM
router.delete("/:albumId", verifyJWT, async (req, res) => {
  try {
    const { albumId } = req.params;

    // Find the album
    const album = await Album.findOne({ albumId });
    if (!album) {
      return res.status(404).json({ message: "Album not found." });
    }

    // Check ownership
    if (album.ownerId !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this album." });
    }

    // Delete album
    await Album.deleteOne({ albumId });

    res.status(200).json({ message: "Album deleted successfully." });
  } catch (error) {
    console.error("Error deleting album:", error);
    res.status(500).json({ message: "Failed to delete album." });
  }
});

module.exports = router;
