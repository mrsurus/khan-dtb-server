const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin.json'); // Path to your Firebase service account JSON

// Initialize Firebase Admin with the service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET_NAME || 'your-project-id.appspot.com', // Replace with your Firebase Storage bucket
});

const bucket = admin.storage().bucket(); // Correct usage of storage bucket

module.exports = { bucket };
