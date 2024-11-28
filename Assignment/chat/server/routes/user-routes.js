// Import core modules
const express = require('express');
const { ObjectId } = require('mongodb');
const { getNextId } = require('../functions/getNextID');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.params.id;
        const userDir = path.join(__dirname, '../uploads/avatars', userId);

        // If the user's directory exists, delete it and all files inside
        if (fs.existsSync(userDir)) {
            fs.rmSync(userDir, { recursive: true, force: true });
        }

        // Recreate the directory to store the new file
        fs.mkdirSync(userDir, { recursive: true });
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename using `crypto`
        const randomString = crypto.randomBytes(16).toString('hex'); // Generate a random 32-character hex string
        const fileExtension = path.extname(file.originalname);
        cb(null, `${randomString}${fileExtension}`);
    }
});

// Filter to allow only .jpg, .jpeg, and .png files
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
        cb(null, true); // Accept file
    } else {
        const error = new Error('Only .jpg, .jpeg, and .png files are allowed');

        cb(null, false);
    }
};

// Initialise multer with storage and file filter
const upload = multer({ storage, fileFilter });


// Create a new Express router instance
module.exports = (db) => {
    const router = express.Router();
    const usersCollection = db.collection('users');
    const groupsCollection = db.collection('groups');
    const reportedUsersCollection = db.collection('reportedUsers');

    // Define the /upload-avatar/:id route
    router.post('/upload-avatar/:id', upload.single('avatar'), async (req, res) => {
        const userId = req.params.id;

        try {
            // Check if user exists
            const user = await usersCollection.findOne({ id: parseInt(userId, 10) });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Define file path for avatar
            const avatarFilePath = `/uploads/avatars/${userId}/${req.file.filename}`;

            // Update the user's avatar path in the database
            await usersCollection.updateOne({ id: parseInt(userId, 10) }, { $set: { avatar: avatarFilePath } });

            // Retrieve the updated user data
            const updatedUser = await usersCollection.findOne({ id: parseInt(userId, 10) });

            res.json({
                success: true,
                message: 'Avatar uploaded successfully!',
                user: updatedUser
            });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            res.status(500).json({ success: false, message: 'Failed to upload avatar' });
        }
    });

    // Define the route to get the user's avatar image by file path
    router.get('/avatar', (req, res) => {
        const filePath = req.query.path;

        // Ensure filePath is within the uploads directory
        const safePath = path.join(__dirname, '../', filePath);

        // Check if the file exists
        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ success: false, message: 'Avatar not found' });
        }

        // Send the avatar file as the response
        res.sendFile(safePath);
    });

    // Define the /users/auth route for user login
    router.post('/auth', async (req, res) => {
        const { username, password } = req.body;
        try {
            const user = await usersCollection.findOne({ username, password, active: true });
            if (user) {
                res.json({
                    success: true,
                    message: 'Login successful! Redirecting...',
                    user: {
                        id: user.id,
                        username: user.username,
                        password: user.password,
                        email: user.email,
                        firstName: user.firstName,
                        surname: user.surname,
                        avatar: user.avatar,
                        permission: user.permission,
                        active: user.active
                    }
                });
            } else {
                res.json({ success: false, message: 'Invalid username or password.' });
            }
        } catch (error) {
            console.error('Error during authentication:', error);
            res.status(500).json({ success: false, message: 'Server error during authentication.' });
        }
    });

    // Define the /users/register route for registering a new user
    router.post('/register', async (req, res) => {
        const { username, password, email, firstName, surname, avatar } = req.body;
        try {
            const existingUser = await usersCollection.findOne({ $or: [{ username }, { email }] });
            if (existingUser) {
                return res.json({ success: false, message: 'Username or email already exists.' });
            }

            // Get the next custom id for the new user
            const newId = await getNextId('users');

            const newUser = {
                id: newId,
                username,
                password,
                email,
                firstName,
                surname,
                avatar,
                permission: 'chat-user',
                active: true
            };
            const result = await usersCollection.insertOne(newUser);
            res.json({
                success: true,
                message: 'Registration successful!',
                user: { ...newUser, _id: result.insertedId }
            });
        } catch (error) {
            console.error('Error during registration:', error);
            res.status(500).json({ success: false, message: 'Server error during registration.' });
        }
    });

    // Define the /users/updateUser route for updating a user's details
    router.put('/updateUser', async (req, res) => {
        const { id, username, password, email, firstName, surname, avatar, permission, active } = req.body;
        try {
            const duplicateUser = await usersCollection.findOne({
                id: { $ne: id },
                $or: [{ username }, { email }]
            });
            if (duplicateUser) {
                return res.json({ success: false, message: 'Username or email already taken.' });
            }

            const updatedUser = { id, username, password, email, firstName, surname, avatar, permission, active };
            const result = await usersCollection.updateOne({ id: id }, { $set: updatedUser });

            if (result.modifiedCount === 0) {
                return res.json({ success: false, message: 'No changes made to the user.' });
            }

            // If user is set to inactive, remove them from relevant groups and channels
            if (updatedUser.active === false) {
                const userId = updatedUser.id;

                try {
                    // Delete any groups where the user is the creator
                    await groupsCollection.deleteMany({ 'creator.id': userId });
            
                    // Remove the user from all relevant arrays in remaining groups where they are not the creator
                    await groupsCollection.updateMany(
                        {},
                        {
                            $pull: {
                                admins: { id: userId },
                                members: { id: userId },
                                interested: { id: userId },
                                banned: { id: userId }
                            }
                        }
                    );
            
                    // Delete any channels in each group where the user is the creator
                    await groupsCollection.updateMany(
                        {}, // Match all group documents
                        {
                            $pull: {
                                channels: { 'creator.id': userId }
                            }
                        }
                    );

                    // Remove the user from any channels in remaining groups
                    await groupsCollection.updateMany(
                        {},
                        {
                            $pull: {
                                'channels.$[channel].admins': { id: userId },
                                'channels.$[channel].members': { id: userId }
                            }
                        },
                        {
                            arrayFilters: [
                                {
                                    $or: [
                                        { 'channel.admins.id': userId },
                                        { 'channel.members.id': userId }
                                    ]
                                }
                            ]
                        }
                    );
                } catch (error) {
                    console.error('Error updating groups and channels:', error);
                    return res.status(500).json({ success: false, message: 'Failed to update groups and channels for inactive user' });
                }
            }

            // Success response
            res.json({ 
                success: true, 
                message: 'Profile updated successfully!',
                user: updatedUser
            });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ success: false, message: 'Failed to update user' });
        }
    });

    router.delete('/deleteUser/:id', async (req, res) => {
        const userId = parseInt(req.params.id, 10);
    
        try {
            // Delete the user from usersCollection
            const userDeleteResult = await usersCollection.deleteOne({ id: userId });
    
            if (userDeleteResult.deletedCount === 0) {
                return res.json({ success: false, message: 'User not found.' });
            }

            // Define the avatar directory path
            const userAvatarDir = path.join(__dirname, '../uploads/avatars', String(userId));
            
            // Check if the avatar directory exists, and delete it if it does
            if (fs.existsSync(userAvatarDir)) {
                fs.rmSync(userAvatarDir, { recursive: true, force: true });
            }
    
            // Delete any groups where the user is the creator
            await groupsCollection.deleteMany({ 'creator.id': userId });
    
            // Remove the user from all relevant arrays in remaining groups where they are not the creator
            await groupsCollection.updateMany(
                { },
                {
                    $pull: {
                        admins: { id: userId },
                        members: { id: userId },
                        interested: { id: userId },
                        banned: { id: userId }
                    }
                }
            );
    
            // Delete any channels in each group where the user is the creator
            await groupsCollection.updateMany(
                {}, // Match all group documents
                {
                    $pull: {
                        channels: { 'creator.id': userId }
                    }
                }
            );

            // Remove the user from any channels in remaining groups, only if channels array has admins or members
            await groupsCollection.updateMany(
                {},
                {
                    $pull: {
                        'channels.$[channel].admins': { id: userId },
                        'channels.$[channel].members': { id: userId }
                    }
                },
                {
                    arrayFilters: [
                        {
                            $or: [
                                { 'channel.admins.id': userId },
                                { 'channel.members.id': userId }
                            ]
                        }
                    ]
                }
            );
    
            res.json({
                success: true,
                message: 'User deleted successfully!',
            });
        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(500).json({ success: false, message: 'Failed to delete user and related references' });
        }
    });

    // Route to report a user
    router.post('/reportUser', async (req, res) => {
        const { userId, reason } = req.body;
        try {
            const user = await usersCollection.findOne({ id: userId });
            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }

            const reportedUser = { user, reason, date: new Date() };
            await reportedUsersCollection.insertOne(reportedUser);
            res.json({ success: true, message: 'User reported successfully.' });
        } catch (error) {
            console.error('Error reporting user:', error);
            res.status(500).json({ success: false, message: 'Failed to report user' });
        }
    });

    // Route to remove a reported user from the reportedUsers collection
    router.post('/removeReportedUser', async (req, res) => {
        const { userId } = req.body;

        if (!userId) {
            return res.json({
                success: false,
                message: 'User ID is required',
            });
        }

        try {
            const result = await reportedUsersCollection.deleteOne({ "user.id": userId });

            if (result.deletedCount > 0) {
                res.json({ success: true, message: 'User banned successfully!' });
            } else {
                return res.json({ success: false, message: 'Reported user not found' });
            }

        } catch (error) {
            console.error('Error removing reported user:', error);
            res.status(500).json({ success: false, message: 'Failed to remove reported user' });
        }
    });

    // Route to get all reported users
    router.get('/getReportedUsers', async (req, res) => {
        try {
            const reportedUsers = await reportedUsersCollection.find().toArray();
            res.json(reportedUsers);
        } catch (error) {
            console.error('Error fetching reported users:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch reported users' });
        }
    });

    // Get all users
    router.get('/users', async (req, res) => {
        try {
            const users = await usersCollection.find().toArray();
            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch users' });
        }
    });

    return router;
};
