const express = require('express');
const { ObjectId } = require('mongodb');
const upload = require('../middleware/upload');
const { bucket } = require('../config/firebaseConfig');
const router = express.Router();
const fs = require('fs')
const { agentsCollection } = require('../config/db');
const path = require('path')
const { getB2Authorization, getUploadUrl, B2_BUCKET_NAME } = require('../config/b2Authorization');
const { default: axios } = require('axios');
const { response } = require('express');

router.post('/:agentId/uploadfile', upload.single('file'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { fileType } = req.body;

    if (!req.file || !fileType) {
      return res.status(400).send("File and file type are required.");
    }

    // Get the upload URL and token from Backblaze B2
    const { uploadUrl, uploadAuthToken } = await getUploadUrl();

    // Generate a unique file name
    const fileName = Date.now() + path.extname(req.file.originalname);

    // Upload the file to Backblaze B2
    const uploadResponse = await axios.post(uploadUrl, req.file.buffer, {
      headers: {
        Authorization: uploadAuthToken,
        'X-Bz-File-Name': fileName,
        'Content-Type': req.file.mimetype,
        'X-Bz-Content-Sha1': 'do_not_verify',
      },
    });

    // Construct the file URL
    const fileUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${fileName}`;
    const fileId = uploadResponse.data.fileId

    // Save file information to the database
    const fileObject = {
      name: req.file.originalname,
      url: fileUrl,
      fileId: fileId
    };

    const updateField = { [`${fileType}`]: fileObject };
    await agentsCollection.updateOne(
      { _id: new ObjectId(agentId) },
      { $push: updateField }
    );

    res.status(200).send({
      message: "File uploaded successfully",
      fileUrl,
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).send({ message: "Error uploading file", error: error.message });
  }
});


router.get('/', async (req, res) => {
  const { page, limit, agentName } = req.query;
  const query = agentName ? { agentName: { $regex: agentName, $options: 'i' } } : {};
  const skip = (page - 1) * limit;
  try {
    // Fetch userss with pagination
    const agents = await agentsCollection
      .find(query)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    // Get total count of documents matching the query
    const total = await agentsCollection.countDocuments(query);

    res.json({
      agents,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error('Error fetching userss:', error);
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
});

router.post('/', async (req, res) => {
  const data = req.body
  const result = agentsCollection.insertOne(data)
  res.send(result)
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;

  // Check if id is a valid ObjectId
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: 'Invalid ID format' });
  }

  // Proceed if id is valid
  const query = { _id: new ObjectId(id) };
  try {
    const result = await agentsCollection.findOne(query);
    if (result) {
      res.send(result);
    } else {
      res.status(404).send({ error: 'Agent not found' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const updateData = req.body; // Data to update, sent in the request body

  // Remove _id if it exists in updateData
  delete updateData._id;


  // Check if id is a valid ObjectId
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: 'Invalid ID format' });
  }

  const query = { _id: new ObjectId(id) };
  const update = {
    $set: updateData
  };

  try {
    const result = await agentsCollection.updateOne(query, update);

    if (result.matchedCount === 0) {
      res.status(404).send({ error: 'Agent not found' });
    } else {
      res.send({ message: 'Agent updated successfully' });
    }
  } catch (error) {
    res.status(500).send({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await agentsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

router.delete('/:agentId/deletefile', async (req, res) => {
  try {
    const { agentId } = req.params; // Agent ID from URL params
    const { fileUrl, fileId } = req.body; // File URL and File ID from request body

    if (!fileUrl || !fileId) {
      return res.status(400).send({ message: "File URL and file ID are required." });
    }

    // Extract file name from the URL
    const fileName = fileUrl.split('/').pop();
    if (!fileName) {
      return res.status(400).send({ message: "Invalid file URL." });
    }

    console.log("File name:", fileName);

    // Step 1: Authenticate with Backblaze
    const { authToken, apiUrl } = await getB2Authorization(); // Ensure this function provides `authToken` and `apiUrl`

    // Step 2: Delete file from Backblaze
    try {
      const deleteResponse = await axios.post(
        `${apiUrl}/b2api/v2/b2_delete_file_version`,
        {
          fileName: fileName,
          fileId: fileId, // Ensure you store and pass the correct file ID
        },
        {
          headers: {
            Authorization: authToken, // Auth token received from Backblaze
          },
        }
      );
      console.log("File deleted from Backblaze:", deleteResponse.data);
    } catch (error) {
      console.error(
        "Error deleting file from Backblaze:",
        error.response ? error.response.data : error.message
      );
      return res.status(500).send({ message: "Error deleting file from storage.", error });
    }

    // Step 3: Remove file reference from MongoDB
    const updateQuery = {
      $pull: {
        image: { url: fileUrl },
        video: { url: fileUrl },
        audio: { url: fileUrl },
        pdf: { url: fileUrl },
      },
    };

    const result = await agentsCollection.updateOne(
      { _id: new ObjectId(agentId) },
      updateQuery
    );

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: "File link not found in any type array." });
    }

    res.status(200).send({ message: "File deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error.message);
    res.status(500).send({ message: "Error deleting file", error });
  }
});


module.exports = router;
