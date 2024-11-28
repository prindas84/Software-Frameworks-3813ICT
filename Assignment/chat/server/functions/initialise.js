// Import MongoDB client
const { getNextId } = require('./getNextID');
const fs = require('fs');
const path = require('path');

async function initialise(db) {
    const usersCollection = db.collection('users');
    const groupsCollection = db.collection('groups');
    const reportedUsersCollection = db.collection('reportedUsers');

    // Drop the users collection if it exists
    await usersCollection.drop().catch((error) => {
        if (error.codeName !== 'NamespaceNotFound') {
            throw error;
        }
    });

    // Drop the groups collection if it exists
    await groupsCollection.drop().catch((error) => {
        if (error.codeName !== 'NamespaceNotFound') {
            throw error;
        }
    });

    // Drop the reported users collection if it exists
    await reportedUsersCollection.drop().catch((error) => {
        if (error.codeName !== 'NamespaceNotFound') {
            throw error;
        }
    });

    // Clear the uploads/avatars directory
    const avatarsDir = path.join(__dirname, '../uploads/avatars');
    if (fs.existsSync(avatarsDir)) {
        fs.readdirSync(avatarsDir).forEach(file => {
            const filePath = path.join(avatarsDir, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log(`Deleted avatar folder: ${filePath}`);
            }
        });
    }

    // Clear the uploads/channels directory
    const groupsDir = path.join(__dirname, '../uploads/groups');
    if (fs.existsSync(groupsDir)) {
        fs.readdirSync(groupsDir).forEach(file => {
            const filePath = path.join(groupsDir, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
                console.log(`Deleted avatar folder: ${filePath}`);
            }
        });
    }

    // Define the users array
    const users = [
        { id: 1, username: "super", password: "123", email: "super@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "super-admin", active: true },
        { id: 2, username: "user1", password: "123", email: "user1@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "super-admin", active: true },
        { id: 3, username: "user2", password: "123", email: "user2@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "group-admin", active: true },
        { id: 4, username: "user3", password: "123", email: "user3@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "group-admin", active: true },
        { id: 5, username: "user4", password: "123", email: "user4@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "chat-user", active: true },
        { id: 6, username: "user5", password: "123", email: "user5@example.com", firstName: "Matthew", surname: "Prendergast", avatar: "", permission: "chat-user", active: false },
    ];

    // Insert the users array into the collection
    await usersCollection.insertMany(users);
    console.log('New users added to the collection.');
}

module.exports = initialise;
