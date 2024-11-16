const express = require('express');
const corsConfig = require('./config/corsConfig');
const {client} = require('./config/db');
const usersRoutes = require('./routes/users');
const agentsRoutes = require('./routes/agents');
const generalRoutes = require('./routes/general');

const app = express();
const port = process.env.PORT || 5000;

app.use(corsConfig);
app.use(express.json());

(async () => {
  try {
    await client.connect();
    console.log('Database connected successfully');

    // Attach collections to request
    app.use((req, res, next) => {
      req.usersCollection = client.db('expoDb').collection('users');
      req.agentsCollection = client.db('expoDb').collection('agents');
      next();
    });

    // Routes
    app.use('/users', usersRoutes);
    app.use('/agents', agentsRoutes);
    app.use('/api', generalRoutes);

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error('Error connecting to database:', err);
  }
})();
