const axios = require('axios');

// Backblaze B2 credentials
const B2_KEY_ID = process.env.B2_KEY_ID;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY;
const B2_BUCKET_ID = process.env.B2_BUCKET_ID;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME;

// Variables to store the auth token and upload URL
let authToken = '';
let apiUrl = ''; // Base API URL

// Function to get Backblaze B2 authorization token and API URL
async function getB2Authorization() {
  try {
    const encodedKey = Buffer.from(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`).toString('base64');
    const authResponse = await axios.get('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        Authorization: `Basic ${encodedKey}`,
      },
    });

    authToken = authResponse.data.authorizationToken;
    apiUrl = authResponse.data.apiUrl; // Base API URL
    console.log('Authorization successful:', { authToken, apiUrl });

    return { authToken, apiUrl }; // Return the values explicitly
  } catch (error) {
    console.error('Error during B2 authorization:', error.message);
    throw new Error('Failed to authorize with Backblaze B2');
  }
}

// Function to get the upload URL from Backblaze
async function getUploadUrl() {
  try {
    if (!authToken || !apiUrl) {
      await getB2Authorization(); // Reauthorize if needed
    }

    const uploadUrlResponse = await axios.post(
      `${apiUrl}/b2api/v2/b2_get_upload_url`,
      { bucketId: B2_BUCKET_ID },
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    console.log('Upload URL retrieved:', uploadUrlResponse.data.uploadUrl);
    return {
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken, // Upload-specific token
    };
  } catch (error) {
    console.error('Error getting upload URL:', error.message);
    throw new Error('Failed to get upload URL from Backblaze B2');
  }
}

module.exports = { getB2Authorization, getUploadUrl, B2_BUCKET_NAME };
