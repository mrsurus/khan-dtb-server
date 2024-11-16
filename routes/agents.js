const express = require('express');
const { ObjectId } = require('mongodb');
const upload = require('../middleware/upload');
const {bucket} = require('../config/firebaseConfig');
const router = express.Router();
const { agentsCollection } = require('../config/db');
const path = require('path')
router.post('/:agentId/uploadfile', upload.single('file'), async (req, res) => {
    try {
        const { agentId } = req.params; // Get agent ID from URL params
        const { fileType } = req.body; // Get file type from request body

        if (!req.file || !fileType) {
          return res.status(400).send("File and file type are required.");
        }

        // File upload to Firebase Storage
        const fileName = Date.now() + path.extname(req.file.originalname); // Unique file name
        const fileUpload = bucket.file(fileName);

        const blobStream = fileUpload.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
          },
        });

        blobStream.on("error", (err) => {
          console.log(err);
          res.status(500).send({ message: "Something went wrong while uploading the file" });
        });

        blobStream.on("finish", async () => {
          await fileUpload.makePublic();

          // Firebase file URL
          const fileUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;

          // Prepare the file object
          const fileObject = {
            name: req.file.originalname,
            url: fileUrl
          };

          // Update the specific agent's document by ID, adding the file to the appropriate type array
          const updateField = { [`${fileType}`]: fileObject };

          await agentsCollection.updateOne(
            { _id: new ObjectId(agentId) },
            { $push: updateField }
          );

          res.status(200).send({
            message: "File uploaded successfully",
            fileUrl: fileUrl,
          });
        });

        blobStream.end(req.file.buffer); // Upload the file buffer
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error uploading file", error });
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
    const { agentId } = req.params; // User ID from URL params
    const { fileUrl } = req.body; // File URL from request body

    if (!fileUrl) {
      return res.status(400).send({ message: "File URL is required." });
    }

    // Extract file name from the URL
    const fileName = fileUrl.split('/').pop();
    console.log(fileName);
    const file = bucket.file(fileName);

    // Attempt to delete the file from Firebase Storage
    try {
      await file.delete();
      console.log("File deleted from Firebase Storage.");
    } catch (error) {
      if (error.code === 404) {
        console.warn("File does not exist in Firebase Storage, skipping deletion.");
      } else {
        throw error;
      }
    }

    // Remove the file object from all possible file type arrays in the user's document
    const updateQuery = {
      $pull: {
        "image": { url: fileUrl },
        "video": { url: fileUrl },
        "audio": { url: fileUrl },
        "pdf": { url: fileUrl }
      }
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
    console.error("Error deleting file:", error);
    res.status(500).send({ message: "Error deleting file", error });
  }
});


module.exports = router;
