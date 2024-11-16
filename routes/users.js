const express = require('express');
const { ObjectId } = require('mongodb');
const upload = require('../middleware/upload');
const { bucket } = require('../config/firebaseConfig');
const router = express.Router();
const { usersCollection } = require('../config/db');
const path = require('path')

router.post('/:email/uploadfile', upload.single('file'), async (req, res) => {
    try {
        const { email } = req.params; // Get agent ID from URL params
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

            await usersCollection.updateOne(
                { email: email },
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
    const { page, limit, email } = req.query;
    const query = email ? { email: { $regex: email, $options: 'i' } } : {};
    const skip = (page - 1) * limit;
    try {
        // Fetch employees with pagination
        const users = await usersCollection
            .find(query)
            .skip(skip)
            .limit(Number(limit))
            .toArray();

        // Get total count of documents matching the query
        const total = await usersCollection.countDocuments(query);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'An error occurred while fetching data' });
    }
});

router.get('/:email', async (req, res) => {
    const getEmail = req.params.email;
    const query = { email: getEmail };
    try {
        const result = await usersCollection.findOne(query);
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ error: 'Agent not found' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    const data = req.body
    const result = usersCollection.insertOne(data)
    res.send(result)
});

router.put('/:id', async (req, res) => {
    const id = req.params.id;
    const updateData = req.body;
    delete updateData._id;

    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid ID format' });
    }

    const query = { _id: new ObjectId(id) };
    const update = {
        $set: updateData
    };

    try {
        const result = await usersCollection.updateOne(query, update);

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
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
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

router.delete('/:userId/deletefile', async (req, res) => {
    try {
      const { userId } = req.params; // User ID from URL params
      const { fileUrl } = req.body; // File URL from request body
        
      if (!fileUrl) {
        return res.status(400).send({ message: "File URL is required." });
      }
  
      // Extract file name from the URL
      const fileName = fileUrl.split('/').pop();
      console.log(fileName)
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

      const updateQuery = {
        $pull: {
          "image": { url: fileUrl },
          "video": { url: fileUrl },
          "audio": { url: fileUrl },
          "pdf": { url: fileUrl }
        }
      };
  
      // Remove the file object from the user's document in MongoDB
      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        updateQuery 
      );
  
      res.status(200).send({ message: "File deleted successfully." });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).send({ message: "Error deleting file", error });
    }
  });
  

module.exports = router;
