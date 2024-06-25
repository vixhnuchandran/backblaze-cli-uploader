import axios from "axios";
import cryptoJS from "crypto-js";
import { configDotenv } from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

configDotenv();

const args = process.argv.slice(2);
const fileArgIndex = args.indexOf("--file");

if (fileArgIndex === -1 || !args[fileArgIndex + 1]) {
  console.error("Please provide a file path using --file <file-path>");
  process.exit(1);
}

const filePath = args[fileArgIndex + 1];
const bucketId = process.env.BUCKET_ID;
const bucketName = process.env.BUCKET_NAME;
const authToken = process.env.AUTH_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getUploadUrl = async () => {
  try {
    const response = await axios.post(
      `https://api005.backblazeb2.com/b2api/v3/b2_get_upload_url`,
      { bucketId },
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    return {
      uploadUrl: response.data.uploadUrl,
      uploadAuthorizationToken: response.data.authorizationToken,
    };
  } catch (err) {
    console.error("Error getting upload URL:", err.response ? err.response.data : err.message);
    process.exit(1);
  }
};

const uploadFile = async (filePath) => {
  try {
    const uploadDetails = await getUploadUrl();
    if (!uploadDetails) throw new Error("Upload details not obtained");

    const uploadUrl = uploadDetails.uploadUrl;
    const uploadAuthorizationToken = uploadDetails.uploadAuthorizationToken;
    const fileName = path.basename(filePath).replace(/\s/g, "");
    const objectKey = Date.now() + "-" + fileName;
    const fileData = await fs.readFile(filePath);
    const sha1 = cryptoJS.SHA1(cryptoJS.lib.WordArray.create(fileData)).toString();

    try {
      const uploadResponse = await axios.post(uploadUrl, fileData, {
        headers: {
          Authorization: uploadAuthorizationToken,
          "X-Bz-File-Name": encodeURIComponent(objectKey),
          "Content-Type": "b2/x-auto",
          "Content-Length": fileData.length,
          "X-Bz-Content-Sha1": sha1,
          "X-Bz-Info-Author": "unknown",
        },
      });

      console.log("File uploaded successfully.");
      console.log("File ID: ", uploadResponse.data.fileId);
      const fileUrl = `https://f005.backblazeb2.com/file/${bucketName}/${objectKey}`;
      return { fileUrl, fileId: uploadResponse.data.fileId };
    } catch (err) {
      console.error("Error uploading file:", err.response ? err.response.data : err.message);
      process.exit(1);
    }
  } catch (err) {
    console.error("Error in upload process:", err.message);
    process.exit(1);
  }
};

const promptUser = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

const downloadFile = async (fileUrl, fileName) => {
  try {
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: authToken,
      },
    });

    const downloadPath = path.join(__dirname,fileName);
    await fs.writeFile(downloadPath, response.data);
    console.log(`File downloaded successfully to ${downloadPath}`);
  } catch (err) {
    console.error("Error downloading file:", err.response ? err.response.data : err.message);
  }
};

const main = async () => {
  const { fileUrl, fileId } = await uploadFile(filePath);
  if (fileUrl) {
    console.log(`File URL: ${fileUrl}`);

    const userResponse = await promptUser("Do you want to download the file? (Y/N): ");
    if (userResponse.trim().toUpperCase() === 'Y') {
      const fileName = path.basename(filePath).replace(/\s/g, "");
      await downloadFile(fileUrl, fileName);
    } else {
      console.log("Download skipped.");
    }
  }
};

main();
