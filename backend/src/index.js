const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db"); // Import DB connection
const socketHandler = require("./controllers/puppeteerController");
const actionRoutes = require("./routes/ActionRoutes"); // Import action routes
const ragRoutes = require("./routes/ragRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

dotenv.config();
connectDB(); // Connect to MongoDB

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: "http://localhost:3000", // Change this to your frontend URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
};

app.use(cors(corsOptions));
app.use(express.json());

// API Routes

app.use("/api/sessions", sessionRoutes);
app.use("/api/actions", actionRoutes);
app.use("/api/rag", ragRoutes);


app.get("/proxy", async (req, res) => {
    const { userId } = req.query;
    if (!activeBrowsers[userId]) {
        return res.status(404).send("Browser not found");
    }
    const { page } = activeBrowsers[userId];
    res.send(await page.content());
});

// Initialize socket connections
socketHandler(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
