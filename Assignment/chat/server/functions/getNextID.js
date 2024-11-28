// Import the MongoClient from the mongodb package
const { MongoClient } = require('mongodb');

// Define the MongoDB connection URL and database name
const url = 'mongodb://localhost:27017';
const dbName = 'chatdb';

// Asynchronously fetch the next ID for a specified collection
async function getNextId(collectionName) {
    // Create a new MongoDB client instance
    const client = new MongoClient(url);
    try {
        // Connect to the MongoDB client
        await client.connect();
        const db = client.db(dbName);

        // Check if the 'channels' collection is requested
        if (collectionName === 'channels') {
            const groupsCollection = db.collection('groups');

            // Fetch all groups to find the highest channel ID among all channels
            const groups = await groupsCollection.find({}).toArray();
            let maxChannelId = 0;

            // Iterate through each group to find the highest channel ID
            groups.forEach(group => {
                if (group.channels && group.channels.length > 0) {
                    const maxIdInGroup = Math.max(...group.channels.map(channel => channel.id));
                    maxChannelId = Math.max(maxChannelId, maxIdInGroup);
                }
            });

            return maxChannelId + 1;

        } else {
            // If not 'channels', fetch the highest `id` in the specified collection
            const collection = db.collection(collectionName);

            // Find the document with the highest `id`, increment by 1 for the next ID
            const lastDocument = await collection.find().sort({ id: -1 }).limit(1).toArray();

            if (lastDocument.length > 0) {
                return lastDocument[0].id + 1;
            } else {
                return 1; // Start from ID 1 if no documents are present
            }
        }

    } catch (err) {
        // Log an error if fetching the next ID fails and re-throw it
        console.error(`Error getting the next ID in the '${collectionName}' collection:`, err);
        throw err;
    } finally {
        // Ensure the MongoDB client is closed after the operation
        await client.close();
    }
}

// Export the getNextId function for use in other modules
module.exports = { getNextId };
