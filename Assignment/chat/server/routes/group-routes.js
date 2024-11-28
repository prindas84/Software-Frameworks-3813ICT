// Import core modules
const express = require('express');
const { ObjectId } = require('mongodb');
const { getNextId } = require('../functions/getNextID');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// Configure multer storage for group file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const groupId = req.params.id;

        // Check if groupId is defined, and handle error if it's not
        if (!groupId) {
            return cb(new Error('Group ID is missing in request parameters'));
        }

        const groupDir = path.join(__dirname, '../uploads/groups', groupId);

        // Create the group directory if it doesn't exist
        if (!fs.existsSync(groupDir)) {
            fs.mkdirSync(groupDir, { recursive: true });
        }

        cb(null, groupDir);
    },
    filename: (req, file, cb) => {
        const randomString = crypto.randomBytes(16).toString('hex');
        const fileExtension = path.extname(file.originalname);
        cb(null, `${randomString}${fileExtension}`);
    }
});

// File filter to allow only .jpg, .jpeg, .bmp and .png files
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.bmp', '.png'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        const error = new Error('Only .jpg, .jpeg, .bmp, and .png files are allowed');
        cb(null, false);
    }
};

// Initialise multer with storage and file filter
const upload = multer({ storage, fileFilter });


// Export the router function that takes `db` as an argument
module.exports = (db) => {
    const router = express.Router();
    const groupsCollection = db.collection('groups');
    const usersCollection = db.collection('users');

    // Route to add the current user to the admins or members array of a channel in a group
    router.post('/addChannelMembers', async (req, res) => {
        // Destructure groupId, channelId, and currentUser from the request body
        const { groupId, channelId, currentUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !channelId || !currentUser) {
            return res.json({
                success: false,
                message: 'Missing groupId, channelId, or currentUser',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({
                    success: false,
                    message: 'Group not found',
                });
            }

            // Find the specific channel within the group by channelId
            const channel = group.channels?.find((c) => c.id === channelId);
            if (!channel) {
                // If channel is not found, respond with an error message
                return res.json({
                    success: false,
                    message: 'Channel not found in the group',
                });
            }

            // Check if the user is the creator, an admin, or a member of the group
            const isCreator = group.creator.username === currentUser.username;
            const isAdmin = group.admins?.some((admin) => admin.username === currentUser.username);
            const isMember = group.members?.some((member) => member.username === currentUser.username);

            // Add the user to the channel admins if they are the creator or an admin
            if (isCreator || isAdmin) {
                if (!channel.admins?.some((admin) => admin.username === currentUser.username)) {
                    channel.admins.push(currentUser);
                }
                // Otherwise, add the user to the channel members if they are a group member
            } else if (isMember) {
                if (!channel.members?.some((member) => member.username === currentUser.username)) {
                    channel.members.push(currentUser);
                }
                // If the user is neither an admin, creator, nor member, deny access
            } else {
                return res.json({
                    success: false,
                    message: 'User does not have access to the group',
                });
            }

            // Update the group's channels in the database to reflect the new admin/member
            await groupsCollection.updateOne({ id: groupId }, { $set: { channels: group.channels } });

            // Respond with a success message and the updated group and channel details
            return res.json({
                success: true,
                message: 'User added to the channel successfully',
                group,
                channel,
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error adding user to channel members:', error);
            res.status(500).json({ success: false, message: 'Failed to add user to channel members' });
        }
    });

    // Route to add a user to the admin array of a group
    router.post('/addGroupAdmin', async (req, res) => {
        // Destructure groupId and username from the request body
        const { groupId, username } = req.body;

        // Check if groupId or username is missing and respond with an error message if so
        if (!groupId || !username) {
            return res.json({
                success: false,
                message: 'Missing groupId or username',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the user by username
            const user = await usersCollection.findOne({ username });
            if (!user) {
                // If user is not found, respond with an error message
                return res.json({ success: false, message: 'User not found' });
            }

            // Check if the user is already an admin in the group
            const isAlreadyAdmin = group.admins?.some((admin) => admin.username === username);
            if (isAlreadyAdmin) {
                return res.json({ success: false, message: 'User is already an admin' });
            }

            // Remove the user from the members list if they are currently a member
            group.members = group.members?.filter((member) => member.username !== username) || [];
            group.admins.push(user);

            // Update the group's admins and members in the database
            await groupsCollection.updateOne({ id: groupId }, { $set: { admins: group.admins, members: group.members } });

            // Respond with a success message
            res.json({
                success: true,
                message: 'User added as admin successfully',
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error adding group admin:', error);
            res.status(500).json({ success: false, message: 'Error adding group admin' });
        }
    });

    // Route to add a message to a specific channel within a group
    router.post('/addMessage', async (req, res) => {
        // Destructure relevant data from the request body
        const { groupId, channelId, messageType, userId, userName, message, avatar } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !channelId || !userId || !message) {
            return res.json({
                success: false,
                message: 'Missing groupId, channelId, userId, or message',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the specific channel in the group's channels array by channelId
            const channel = group.channels?.find((c) => c.id === channelId);
            if (!channel) {
                // If channel is not found, respond with an error message
                return res.json({ success: false, message: 'Channel not found in group' });
            }

            // Create a new message object with the data provided
            const newMessage = {
                channelId,
                userId,
                userName,
                messageType,
                message,
                avatar,
            };

            // Add the new message to the messages array of the channel
            channel.messages.push(newMessage);

            // Update the group's channels in the database
            await groupsCollection.updateOne(
                { id: groupId },
                { $set: { channels: group.channels } }
            );

            // Respond with a success message
            res.json({
                success: true,
                message: 'Message added to channel successfully',
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error adding message to channel:', error);
            res.status(500).json({ success: false, message: 'Failed to add message' });
        }
    });

    // Route to approve a user registration to the members array of a group
    router.post('/approveRegistration', async (req, res) => {
        // Destructure groupId, userUsername, and requestingUser from the request body
        const { groupId, userUsername, requestingUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !userUsername || !requestingUser) {
            return res.json({
                success: false,
                message: 'Missing groupId, userUsername, or requestingUser',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the requesting user has permission to approve the registration
            const isCreator = group.creator.username === requestingUser.username;
            const isSuperAdmin = requestingUser.permission === 'super-admin';
            const isAdmin = group.admins?.some((admin) => admin.username === requestingUser.username);

            if (!isCreator && !isSuperAdmin && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Unauthorised: You do not have permission to approve this registration',
                });
            }

            // Find the user by userUsername
            const user = await usersCollection.findOne({ username: userUsername });
            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }

            // Remove the user from the banned and interested lists if present
            group.banned = group.banned?.filter((bannedUser) => bannedUser.username !== userUsername) || [];
            group.interested = group.interested?.filter((u) => u.username !== userUsername) || [];

            // Check if the user is already a member of the group
            if (group.members?.some((member) => member.username === userUsername)) {
                return res.json({ success: false, message: 'User is already a member' });
            }

            // Add the user to the members array of the group
            group.members.push(user);

            // Update the group's members, banned, and interested lists in the database
            await groupsCollection.updateOne({ id: groupId }, { $set: { banned: group.banned, interested: group.interested, members: group.members } });

            // Respond with a success message
            res.json({ success: true, message: 'User approved and added to members' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error approving user registration:', error);
            res.status(500).json({ success: false, message: 'Failed to approve registration' });
        }
    });

    // Route to ban a user and remove them from admins, members, and interested lists
    router.post('/banUser', async (req, res) => {
        // Destructure groupId and username from the request body
        const { groupId, username } = req.body;

        // Check if groupId or username is missing and respond with an error message if so
        if (!groupId || !username) {
            return res.json({
                success: false,
                message: 'Missing groupId or username',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the user by username
            const user = await usersCollection.findOne({ username });
            if (!user) {
                // If user is not found, respond with an error message
                return res.json({ success: false, message: 'User not found' });
            }

            // Remove the user from the admins, members, and interested lists
            group.admins = group.admins?.filter((admin) => admin.username !== username) || [];
            group.members = group.members?.filter((member) => member.username !== username) || [];
            group.interested = group.interested?.filter((interested) => interested.username !== username) || [];

            // If the user is not already in the banned list, add them
            if (!group.banned?.some((banned) => banned.username === username)) {
                group.banned.push(user);
            }

            // Update the group's admins, members, interested, and banned lists in the database
            await groupsCollection.updateOne(
                { id: groupId },
                { $set: { admins: group.admins, members: group.members, interested: group.interested, banned: group.banned } }
            );

            // Respond with a success message
            res.json({
                success: true,
                message: 'User successfully banned and removed from other lists',
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error banning user:', error);
            res.status(500).json({ success: false, message: 'Failed to ban user' });
        }
    });

    // Route to create a new channel in a group
    router.post('/createChannel', async (req, res) => {
        // Destructure groupId, channelName, and currentUser from the request body
        const { groupId, channelName, currentUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !channelName || !currentUser) {
            return res.json({ success: false, message: 'Missing groupId, channelName, or currentUser' });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the requesting user is the creator or an admin of the group
            const isCreator = group.creator.username === currentUser.username;
            const isAdmin = group.admins?.some((admin) => admin.username === currentUser.username);

            if (!isCreator && !isAdmin) {
                return res.json({ success: false, message: 'Unauthorised: You do not have permission to create a channel in this group' });
            }

            // Get the next channel ID and define a new channel object
            const newChannelId = await getNextId('channels');
            const newChannel = { id: newChannelId, channelName: channelName, creator: currentUser, admins: [currentUser], members: [], messages: [] };

            // Update the group's channels in the database by adding the new channel
            await groupsCollection.updateOne({ id: groupId }, { $push: { channels: newChannel } });

            // Respond with a success message and the new channel details
            res.json({
                success: true,
                message: 'Channel created successfully.',
                channel: newChannel,
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error creating channel:', error);
            res.status(500).json({ success: false, message: 'Failed to create channel' });
        }
    });

    // Route to create a new group
    router.post('/createGroup', async (req, res) => {
        // Destructure groupName and creatorUsername from the request body
        const { groupName, creatorUsername } = req.body;

        // Check if groupName or creatorUsername is missing and respond with an error message if so
        if (!groupName || !creatorUsername) {
            return res.json({ success: false, message: 'Missing groupName or creatorUsername' });
        }

        try {
            // Find the user by creatorUsername to set them as the creator
            const creator = await usersCollection.findOne({ username: creatorUsername });
            if (!creator) {
                return res.json({ success: false, message: 'Failed to create group: Creator not found' });
            }

            // Get the next group ID and define a new group object
            const newGroupId = await getNextId('groups');
            const newGroup = {
                id: newGroupId,
                groupName: groupName,
                creator,
                admins: [creator],
                members: [],
                interested: [],
                banned: [],
                channels: [],
            };

            // Insert the new group into the database
            await groupsCollection.insertOne(newGroup);

            // Create a directory for the group in uploads/groups if it does not exist
            const groupDir = path.join(__dirname, '../uploads/groups', String(newGroupId));
            if (!fs.existsSync(groupDir)) {
                fs.mkdirSync(groupDir, { recursive: true });
            }

            // Respond with a success message and the new group details
            res.json({
                success: true,
                message: 'Group created successfully!',
                group: newGroup,
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error creating group:', error);
            res.status(500).json({ success: false, message: 'Failed to create group' });
        }
    });

    // Route to delete a channel from a group
    router.post('/deleteChannel', async (req, res) => {
        // Destructure groupId, channelId, and currentUser from the request body
        const { groupId, channelId, currentUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !channelId || !currentUser) {
            return res.json({ success: false, message: 'Missing groupId, channelId, or currentUser' });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the requesting user is the creator or an admin of the group
            const isCreator = group.creator.username === currentUser.username;
            const isAdmin = group.admins?.some((admin) => admin.username === currentUser.username);

            if (!isCreator && !isAdmin) {
                return res.json({ success: false, message: 'Unauthorised: You do not have permission to delete a channel from this group' });
            }

            // Remove the specified channel from the group's channels in the database
            await groupsCollection.updateOne(
                { id: groupId },
                { $pull: { channels: { id: channelId } } }
            );

            // Respond with a success message
            res.json({
                success: true,
                message: 'Channel deleted successfully',
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error deleting channel:', error);
            res.status(500).json({ success: false, message: 'Failed to delete channel' });
        }
    });

    // Route to delete a group
    router.delete('/deleteGroup/:id', async (req, res) => {
        // Parse the groupId from the request parameters
        const groupId = parseInt(req.params.id, 10);

        try {
            // Delete the group document from the groups collection
            const result = await groupsCollection.deleteOne({ id: groupId });

            // Check if the group was successfully deleted and respond accordingly
            if (result.deletedCount > 0) {
                // Define the path to the group's directory. Check if it exists, and delete it if present
                const groupDir = path.join(__dirname, '../uploads/groups', String(groupId));
                if (fs.existsSync(groupDir)) {
                    fs.rmSync(groupDir, { recursive: true, force: true });
                }

                // Respond with a success message confirming the group deletion
                res.json({ success: true, message: 'Group deleted successfully!' });
                return;
            }
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error deleting group:', error);
            res.status(500).json({ success: false, message: 'Failed to delete group' });
        }
    });

    // Route to deregister a user from a group
    router.post('/deregister', async (req, res) => {
        // Destructure groupId and username from the request body
        const { groupId, username } = req.body;

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Update the group's interested list by removing the specified username
            await groupsCollection.updateOne(
                { id: groupId },
                { $pull: { interested: { username } } }
            );

            // Respond with a success message confirming deregistration
            res.json({ success: true, message: 'User deregistered from the group successfully.' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error deregistering user from group:', error);
            res.status(500).json({ success: false, message: 'Failed to deregister user' });
        }
    });

    // Route to get messages for a specific channel within a group
    router.get('/getMessages', async (req, res) => {
        // Parse groupId and channelId from the query parameters
        const groupId = parseInt(req.query.groupId, 10);
        const channelId = parseInt(req.query.channelId, 10);

        // Check if groupId or channelId is missing and respond with an error message if so
        if (!groupId || !channelId) {
            return res.json({
                success: false,
                message: 'Missing groupId or channelId',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the specific channel in the group's channels array by channelId
            const channel = group.channels?.find((c) => c.id === channelId);
            if (!channel) {
                // If channel is not found, respond with an error message
                return res.json({ success: false, message: 'Channel not found in group' });
            }

            // Respond with the messages array of the specified channel
            res.json({
                success: true,
                messages: channel.messages,
            });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error fetching messages:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch messages' });
        }
    });

    // Route to return the list of groups
    router.get('/groups', async (req, res) => {
        try {
            // Fetch all groups from the groups collection and convert to an array
            const groups = await groupsCollection.find().toArray();

            // Respond with the array of groups
            res.json(groups);
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error fetching groups:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch groups' });
        }
    });

    // Define the route to get an image from a specific group's directory
    router.get('/group-image', (req, res) => {
        // Get the file path from the request query
        const filePath = req.query.path;

        // Ensure the filePath is within the uploads directory to prevent directory traversal
        const safePath = path.join(__dirname, '../', filePath);

        // Check if the file exists at the specified path
        if (!fs.existsSync(safePath)) {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }

        // Send the image file as the response
        res.sendFile(safePath);
    });

    // Route to leave a channel
    router.post('/leaveChannel', async (req, res) => {
        // Destructure groupId, channelId, and currentUser from the request body
        const { groupId, channelId, currentUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !channelId || !currentUser) {
            return res.json({ success: false, message: 'Missing groupId, channelId, or currentUser' });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the specific channel in the group's channels array by channelId
            const channel = group.channels?.find((c) => c.id === channelId);
            if (!channel) {
                // If channel is not found, respond with an error message
                return res.json({ success: false, message: 'Channel not found' });
            }

            // Check if the current user is the creator of the channel
            const isChannelCreator = channel.creator.username === currentUser.username;
            if (isChannelCreator) {
                return res.json({ success: false, message: 'The channel creator cannot leave the channel' });
            }

            // Update the group's channels by removing the user from admins and members of the specified channel
            await groupsCollection.updateOne(
                { id: groupId, 'channels.id': channelId },
                {
                    $pull: {
                        'channels.$.admins': { username: currentUser.username },
                        'channels.$.members': { username: currentUser.username },
                    },
                }
            );

            // Respond with a success message
            res.json({ success: true, message: 'User left the channel successfully.' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error leaving channel:', error);
            res.status(500).json({ success: false, message: 'Failed to leave channel' });
        }
    });

    // Route to leave a group
    router.post('/leaveGroup', async (req, res) => {
        // Destructure groupId and username from the request body
        const { groupId, username } = req.body;

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Update the group's admins and members by removing the specified username
            await groupsCollection.updateOne(
                { id: groupId },
                {
                    $pull: {
                        admins: { username },
                        members: { username },
                    },
                }
            );

            // Respond with a success message confirming the user has left the group
            res.json({ success: true, message: 'User has left the group.' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error leaving group:', error);
            res.status(500).json({ success: false, message: 'Failed to leave group' });
        }
    });

    // Route to register a user for a group
    router.post('/register', async (req, res) => {
        // Destructure groupId and username from the request body
        const { groupId, username } = req.body;

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the user by username
            const user = await usersCollection.findOne({ username });
            if (!user) {
                // If user is not found, respond with an error message
                return res.json({ success: false, message: 'User not found' });
            }

            // Add the user to the interested list of the group, ensuring no duplicates
            await groupsCollection.updateOne(
                { id: groupId },
                { $addToSet: { interested: user } }
            );

            // Respond with a success message
            res.json({ success: true, message: 'User registered for the group successfully.' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error registering user for group:', error);
            res.status(500).json({ success: false, message: 'Failed to register user' });
        }
    });

    // Route to remove a user from the admin array and add them to the members array of a group
    router.post('/removeAdmin', async (req, res) => {
        // Destructure groupId, adminUsername, and requestingUser from the request body
        const { groupId, adminUsername, requestingUser } = req.body;

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the requesting user has permission to remove an admin
            const isCreator = group.creator.username === requestingUser.username;
            const isSuperAdmin = requestingUser.permission === 'super-admin';
            const isAdmin = group.admins.some(admin => admin.username === requestingUser.username);

            if (!isCreator && !isSuperAdmin && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Unauthorised: You do not have permission to remove this admin',
                });
            }

            // Check if the specified user is an admin in the group
            const adminIndex = group.admins.findIndex(admin => admin.username === adminUsername);
            if (adminIndex === -1) {
                return res.json({ success: false, message: 'User is not an admin' });
            }

            // Remove the user from the admins list and add them to the members list
            const user = group.admins[adminIndex];
            await groupsCollection.updateOne(
                { id: groupId },
                {
                    $pull: { admins: { username: adminUsername } },
                    $addToSet: { members: user }
                }
            );

            // Respond with a success message
            res.json({ success: true, message: 'Admin removed and added to members.' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error removing admin:', error);
            res.status(500).json({ success: false, message: 'Failed to remove admin' });
        }
    });

    // Route to remove a user from all group lists (admins, members, interested, and banned)
    router.post('/removeUser', async (req, res) => {
        // Destructure groupId, userUsername, and requestingUser from the request body
        const { groupId, userUsername, requestingUser } = req.body;

        // Check if any required data is missing and respond with an error message if so
        if (!groupId || !userUsername || !requestingUser) {
            return res.json({
                success: false,
                message: 'Missing groupId, userUsername, or requestingUser',
            });
        }

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the requesting user has permission to remove the specified user
            const isCreator = group.creator.username === requestingUser.username;
            const isSuperAdmin = requestingUser.permission === 'super-admin';
            const isAdmin = group.admins.some(admin => admin.username === requestingUser.username);

            if (!isCreator && !isSuperAdmin && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Unauthorised: You do not have permission to remove this user',
                });
            }

            // Remove the user from all lists: admins, members, interested, and banned
            await groupsCollection.updateOne(
                { id: groupId },
                {
                    $pull: {
                        admins: { username: userUsername },
                        members: { username: userUsername },
                        interested: { username: userUsername },
                        banned: { username: userUsername },
                    },
                }
            );

            // Respond with a success message
            res.json({ success: true, message: 'User removed from all lists' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error removing user:', error);
            res.status(500).json({ success: false, message: 'Failed to remove user' });
        }
    });

    // Route to upload an image to a specific group's directory
    router.post('/uploadImage/:id', (req, res) => {
        // Use multer to handle single image file upload
        upload.single('image')(req, res, async (err) => {
            // Retrieve groupId from URL parameter
            const groupId = req.params.id;

            // Check if there’s a file validation error and respond with a 400 status if so
            if (req.fileValidationError) {
                return res.status(400).json({ success: false, message: req.fileValidationError });
            } else if (err) {
                // Log any other errors and respond with a generic failure message
                console.error('Error uploading image:', err);
                return res.status(500).json({ success: false, message: 'Failed to upload image' });
            }

            // If no file was uploaded, return an error message
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            try {
                // Check if the group exists by groupId
                const group = await groupsCollection.findOne({ id: parseInt(groupId, 10) });
                if (!group) {
                    // Respond with a 404 status if the group is not found
                    return res.status(404).json({ success: false, message: 'Group not found' });
                }

                // Define the file path for the uploaded image
                const imageFilePath = `/uploads/groups/${groupId}/${req.file.filename}`;

                // Respond with a success message and the image path
                res.json({
                    success: true,
                    message: 'Image uploaded successfully!',
                    imageUrl: imageFilePath
                });
            } catch (error) {
                // Log any errors that occur and respond with a generic failure message
                console.error('Error uploading image:', error);
                res.status(500).json({ success: false, message: 'Failed to upload image' });
            }
        });
    });

    // Route to get a group by its ID
    router.get('/view-group/:id', async (req, res) => {
        // Parse groupId and userId from request parameters and query respectively
        const groupId = parseInt(req.params.id, 10);
        const userId = parseInt(req.query.userID, 10);

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Check if the user is part of the group
            const isUserInGroup =
                group.creator.id === userId ||
                group.admins.some(admin => admin.id === userId) ||
                group.members.some(member => member.id === userId);

            // Respond with the group data if the user has access, otherwise deny access
            if (isUserInGroup) {
                return res.json(group);
            }

            res.json({ success: false, message: 'Access denied' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error fetching group:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch group' });
        }
    });

    // Route to get a group by its ID and check if the user has access to a channel in that group
    router.get('/view-group/:groupId/channel/:channelId', async (req, res) => {
        // Parse groupId, channelId, and userId from request parameters and query
        const groupId = parseInt(req.params.groupId, 10);
        const channelId = parseInt(req.params.channelId, 10);
        const userId = parseInt(req.query.userID, 10);

        try {
            // Find the group by groupId
            const group = await groupsCollection.findOne({ id: groupId });
            if (!group) {
                // If group is not found, respond with an error message
                return res.json({ success: false, message: 'Group not found' });
            }

            // Find the specific channel in the group's channels array by channelId
            const channel = group.channels?.find(c => c.id === channelId);
            if (!channel) {
                // If channel is not found, respond with an error message
                return res.json({ success: false, message: 'Channel not found' });
            }

            // Check if the user is an admin or member of the channel
            const isAdmin = channel.admins.some(admin => admin.id === userId);
            const isMember = channel.members.some(member => member.id === userId);

            // Respond with group and channel data if the user has access, otherwise deny access
            if (isAdmin || isMember) {
                return res.json({
                    success: true,
                    data: { group, channel },
                });
            }

            res.json({ success: false, message: 'Access denied to channel' });
        } catch (error) {
            // Log any errors that occur and respond with a generic failure message
            console.error('Error fetching channel:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch channel' });
        }
    });

    return router;
};