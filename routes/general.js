const express = require('express');
const downloadFile = require('../utils/downloadFile');
const router = express.Router();
const { usersCollection } = require('../config/db');

router.get('/download', async (req, res) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).send("File URL is required");
  }
  await downloadFile(fileUrl, res);
});

router.post('/check-email', async (req, res) => {
    const { email } = req.body;
    try {
      const user = await usersCollection.findOne({ email });
      if (user) {
        res.json({ exists: true });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error checking email in the database' });
    }
});

router.get('/get-role', async (req, res) => {
    const email = req.query.email;  
    try {
      const user = await usersCollection.findOne({ email });
     
      if (user && user.role) {
        res.json({ role: user.role });
      } else {
        res.status(404).json({ error: 'User not found or role not set' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving user role from database' });
    }
});

module.exports = router;
