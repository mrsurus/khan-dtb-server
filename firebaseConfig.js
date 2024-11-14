const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin.json'); // Get this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET_NAME // Replace with your Firebase Storage bucket
});

const bucket = admin.storage().bucket();

module.exports = { bucket };
