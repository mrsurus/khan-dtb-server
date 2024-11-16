const axios = require('axios');

const downloadFile = async (fileUrl, res) => {
  try {
    const response = await axios.get(fileUrl, { responseType: 'stream' });
    const contentType = response.headers['content-type'];
    const contentDisposition = `attachment; filename=${fileUrl.split('/').pop()}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition);

    response.data.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error.message);
    res.status(500).send("Failed to download file");
  }
};

module.exports = downloadFile;
