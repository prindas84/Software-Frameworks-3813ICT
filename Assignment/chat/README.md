# Full Documentation

[Assignment Report - Milestone 2.pdf](https://github.com/prindas84/chat/blob/4c6aedfaebd09511ccb9026369016470cd485e9b/Assignment%20Report%20-%20Milestone%202.pdf)

# Chat Application

This is a chat application built with Angular and Node.js.

## Prerequisites

Before you begin, ensure you have met the following requirements:
- You have installed [Node.js](https://nodejs.org/).
- You have installed [Angular CLI](https://angular.io/cli).

## Getting Started

To get a local copy up and running, follow these simple steps.

### Clone the repository

Clone the repository using the following command:

\```
git clone https://github.com/prindas84/chat.git
\```

### Frontend Setup

1. Navigate to the `src` directory:

   \```
   cd chat/src
   \```

2. Install the necessary dependencies for the Angular frontend:

   \```
   npm install
   npm install -g @angular/cli@17
   npm install socket.io-client
   \```

3. Build the Angular project:

   \```
   ng build
   \```

### Backend Setup

1. Navigate out of the `src` directory and into the `server` directory:

   \```
   cd ../server
   \```

2. Install the necessary dependencies for the Node.js backend:

   \```
   npm install
   npm install mongodb
   npm install multer
   npm install socket.io
   \```

3. Start the server:

   \```
   node server.js
   \```

## Accessing the Application

Once the server is running, open your web browser and navigate to:

\```
http://localhost:3000
\```
