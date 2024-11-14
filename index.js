const express = require('express')
const app = express()
const port = process.env.PORT || 5000;
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { bucket } = require('./firebaseConfig')
const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid');
const { default: axios } = require('axios');
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({origin: 'http://localhost:5173' }))
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nzh9xhl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {

  try {
    await client.connect();
    // Send a ping to confirm a successful connection
    const database = client.db("expoDb")
    const usersCollection = database.collection("users")
    const agentsCollection = database.collection("agents")


    // upload employee info
    app.post('/agents/:agentId/uploadfile', upload.single('file'), async (req, res) => {
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
    
    // emlopyee 
    app.get('/agents', async (req, res) => {
      const { page = 1, limit = 5, agentName } = req.query;
      const query = agentName ? { agentName: { $regex: agentName, $options: 'i' } } : {};
      const skip = (page - 1) * limit;
      try {
        // Fetch employees with pagination
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
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'An error occurred while fetching data' });
      }
    });


    //  post user 
    app.post('/users', async (req, res) => {
      const data = req.body
      const result = usersCollection.insertOne(data)
      res.send(result)
    })
    app.get('/users', async (req, res) => {
      const query = {}
      const users = await usersCollection.find(query).toArray()
      res.send(users)
    })
    app.post('/agents', async (req, res) => {
      const data = req.body
      const result = agentsCollection.insertOne(data)
      res.send(result)
    })

    app.get('/agents/:id', async (req, res) => {
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

    app.put('/agents/:id', async (req, res) => {
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

    app.get('/download', async (req, res) => {
      
      const { fileUrl } = req.query;
      console.log(fileUrl)
      if (!fileUrl) {
          return res.status(400).send("File URL is required");
      }
  
      try {
          // Fetch the file from the specified URL
          const response = await axios.get(fileUrl, { responseType: 'stream' });
          const contentType = response.headers['content-type'];
          const contentDisposition = `attachment; filename=${fileUrl.split('/').pop()}`;
  
          // Set headers for download
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', contentDisposition);
  
          // Stream the file to the client
          response.data.pipe(res);
      } catch (error) {
          console.error("Error downloading file:", error.message);
          res.status(500).send("Failed to download file");
      }
  });




  } finally {
    // await client.close();
  }

}
run().catch(console.log)

app.get('/', (req, res) => {
  res.send('Science pedia server is running')
})

app.listen(port, (req, res) => {
  console.log('server is running on port', port)
})

