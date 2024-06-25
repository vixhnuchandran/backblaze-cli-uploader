import axios from "axios"
import cryptoJS from "crypto-js"
import fs from "fs/promises"
import path from "path"

const args = process.argv.slice(2)
const fileArgIndex = args.indexOf("--file")
if (fileArgIndex === -1 || !args[fileArgIndex + 1]) {
  console.error("Please provide a file path using --file <file-path>")
  process.exit(1)
}
const filePath = args[fileArgIndex + 1]

const bucketId = "468f0997c3674d8397080614"
const bucketName = "storybrain-test-bucket"
const authToken =
  "4_0056f9737d378640000000004_01b54229_4ae9c5_acct_083JiQfzlo0jpNIUUzxdyen0TIA="

const getUploadUrl = async () => {
  try {
    const response = await axios.post(
      `https://api005.backblazeb2.com/b2api/v1/b2_get_upload_url`,
      { bucketId },
      {
        headers: {
          Authorization: authToken,
        },
      }
    )

    return {
      uploadUrl: response.data.uploadUrl,
      uploadAuthorizationToken: response.data.authorizationToken,
    }
  } catch (err) {
    console.error("Error getting upload URL:", err)
    process.exit(1)
  }
}

const uploadFile = async filePath => {
  try {
    const uploadDetails = await getUploadUrl()
    if (!uploadDetails) throw new Error("Upload details not obtained")

    const uploadUrl = uploadDetails.uploadUrl
    const uploadAuthorizationToken = uploadDetails.uploadAuthorizationToken

    const fileName = path.basename(filePath).replace(/\s/g, ""); 

    const objectkey = Date.now() + "-" + fileName;

    const fileData = await fs.readFile(filePath)
    const sha1 = cryptoJS
      .SHA1(cryptoJS.lib.WordArray.create(fileData))
      .toString()

    try {
      await axios.post(uploadUrl, fileData, {
        headers: {
          Authorization: uploadAuthorizationToken,
          "X-Bz-File-Name": encodeURIComponent(objectkey),
          "Content-Type": "b2/x-auto",
          "Content-Length": fileData.length,
          "X-Bz-Content-Sha1": sha1,
          "X-Bz-Info-Author": "unknown",
        },
      })

      const fileUrl = `https://f005.backblazeb2.com/file/${bucketName}/${objectkey}`
      return fileUrl
    } catch (err) {
      console.error("Error uploading file:", err)
      process.exit(1)
    }
  } catch (err) {
    console.error("Error in upload process:", err)
    process.exit(1)
  }
}

const main = async () => {
  const fileUrl = await uploadFile(filePath)
  if (fileUrl) {
    console.log(fileUrl)
  }
}

main()
