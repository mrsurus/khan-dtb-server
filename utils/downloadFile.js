const axios = require("axios");
const { getB2Authorization } = require("../config/b2Authorization");

async function downloadFile(req, res) {
  const { fileUrl } = req.query;

  if (!fileUrl) {
    return res.status(400).send("File URL is required");
  }

  try {
    // Step 1: Authenticate with Backblaze B2
    const { authorizationToken } = await getB2Authorization();

    // Step 2: Stream the file to the client
    const response = await axios.get(fileUrl, {
      responseType: "stream",
      headers: {
        Authorization: authorizationToken,
      },
    });

    // Set headers to allow file download
    res.setHeader("Content-Type", response.headers["content-type"]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileUrl.split("/").pop()}"`
    );

    // Pipe the file stream to the response
    response.data.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error.message);
    res.status(500).send("Failed to download the file");
  }
}

module.exports = { downloadFile };
