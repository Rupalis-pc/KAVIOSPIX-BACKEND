const express = require("express");
const { initialiseDatabase } = require("./db/db.connect");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { default: axios } = require("axios");

const albumRoutes = require("./routes/album.routes");
const imageRoutes = require("./routes/image.routes");
const usersRoutes = require("./routes/users.routes");

const app = express();
initialiseDatabase();

app.use(express.json());
app.use(
  cors({
    origin: "https://kaviospix-frontend.vercel.app",
    credentials: true,
  })
);

// Routes
app.use("/albums", albumRoutes);
app.use("/albums", imageRoutes);
app.use("/users", usersRoutes);

const SECRET_KEY = "yoursecret";
const JWT_SECRET = "your_jwt_secret";

// app.post("/admin/login", (req, res) => {
//   const { secret } = req.body;

//   if (secret === SECRET_KEY) {
//     res.json({ message: "Access Granted" });
//   } else {
//     res.json({ message: "Invalid Secret" });
//   }
// });

// JWT Middleware
const verifyJWT = require("./utils/verifyJWT");

app.post("/admin/login", (req, res) => {
  const { secret } = req.body;

  if (secret === SECRET_KEY) {
    const token = jwt.sign(
      {
        userId: "test-admin-id",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({ token });
  } else {
    res.json({ message: "Invalid Secret." });
  }
});

// 1.Initiate Google OAuth
app.get("/auth/google", (req, res) => {
  const redirectUri = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${process.env.GOOGLE_CLIENT_ID}&scope=openid%20email%20profile&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}`;
  res.redirect(redirectUri);
});

// 2.Handle Google callback
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ message: "No code provided" });

  try {
    // Exchange auth code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    //Use access token to fetch user info
    const userResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const { email, id, name, picture } = userResponse.data;

    //Create JWT for your app
    const token = jwt.sign({ userId: id, email, name, picture }, JWT_SECRET, {
      expiresIn: "24h",
    });

    //Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Google Auth failed" });
  }
});

// Protected Route Example
app.get("/api/protected", verifyJWT, (req, res) => {
  res.json({
    message: "Access granted to protected route",
    user: req.user,
  });
});

// Server
const PORT = 4000;

app.listen(PORT, () => {
  console.log("Server running on PORT", PORT);
});
