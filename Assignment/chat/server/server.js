// Import core modules first
var path = require('path');
var http = require('http');

// Import Express-related modules
const express = require('express');
const cors = require('cors');
var bodyParser = require('body-parser');

// Setup MongoDB
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

// Import custom modules (routes)
var userRoutes = require('./routes/user-routes');
var groupRoutes = require('./routes/group-routes');

// Import initialise function to setup starter user
const initialise = require('./functions/initialise');

// Create an instance of Express and MongoDB
const app = express();
const port = 3000;
const url = 'mongodb://localhost:27017';
const dbName = 'chatdb';
const client = new MongoClient(url);

// Middleware to parse URL-encoded bodies (for form submissions)
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware to parse JSON bodies (for API requests)
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, '../dist/chat/browser/')));

// Custom error handling middleware for file type errors
app.use((err, req, res, next) => {
    // Check if error is related to file type limits
    if (err.code === 'LIMIT_FILE_TYPE') {
        res.status(400).json({ success: false, message: err.message });
    } else {
        // Pass other errors to the default error handler
        next(err);
    }
});

// MongoDB connection
client.connect()
    .then(async () => {
        
        // Set up database connection
        const db = client.db(dbName);

        // Initialise the starter user in the database
        await initialise(db);

        // Provide the database to the routes
        app.use('/api/users', userRoutes(db));
        app.use('/api/groups', groupRoutes(db));

        // Create an HTTP server using the Express app
        const server = http.createServer(app);

        // Initialize Socket.io with the HTTP server
        const io = require('socket.io')(server);

        // Handle Socket.io connections
        io.on('connection', (socket) => {
            socket.on('joinChannel', (channelId) => {
                console.log(`User connected to channel ${channelId}: ${socket.id}`);
                socket.join(channelId);
                socket.to(channelId).emit('user-connected', socket.id);
            });
            
            socket.on('offer', ({ sdp, type, channelId, senderId, senderName }) => {
                if (sdp && type) {
                    socket.to(channelId).emit('offer', { sdp, type, senderId, senderName });
                } else {
                    console.error("Invalid offer received:", { sdp, type });
                }
            });

            socket.on('answer', ({ answer, senderId }) => {
                if (answer && answer.sdp && answer.type) {
                    io.to(senderId).emit('answer', { answer });
                } else {
                    console.error("Invalid answer received:", answer);
                }
            });

            // Listen for ICE candidates
            socket.on('ice-candidate', ({ candidate, senderId }) => {
                io.to(senderId).emit('ice-candidate', { candidate });
            });

            socket.on('leaveChannel', (channelId) => {
                socket.leave(channelId);
                socket.to(channelId).emit('user-disconnected', socket.id);
            });

            socket.on('message', (data) => {
                const { channelId, userId, userName, messageType, message, avatar } = data;
                io.to(channelId).emit('message', { channelId, userId, userName, messageType, message, avatar });
            });

            // Handle disconnection (optional empty function)
            socket.on('disconnect', () => {
                console.log(`User disconnected: ${socket.id}`);
                io.emit('user-disconnected', socket.id);
            });
        });

        // Start the server on port 3000
        server.listen(port, () => {
            console.log(`Server listening on port: ${port}`);
        });
    })
    .catch((err) => {
        // Log error and exit if unable to connect to MongoDB
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1); // Exit process with error status
    });