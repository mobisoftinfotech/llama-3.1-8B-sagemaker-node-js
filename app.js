const express = require("express");
const bodyParser = require("body-parser");
const {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} = require("@aws-sdk/client-sagemaker-runtime");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const client = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  });

const ANSWER_SEPARATOR = "<|eot_id|>";

function generateFormattedString(messages) {
  let output = "";
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    output += messages[i].role + " : " + messages[i].content;
    if (i < messages.length - 1) {
      output += "\n";
    }
  }
  return output + ANSWER_SEPARATOR;
}

function parseResponse(data) {
  const responseBody = JSON.parse(Buffer.from(data.Body).toString("utf-8"));
  if (responseBody.length != 1) {
    throw new Error("Failed to parse the LLM response");
  }
  if (!responseBody[0].generated_text) {
    throw new Error("Failed to parse the LLM response");
  }
  const answerParts = responseBody[0].generated_text.split(ANSWER_SEPARATOR);
  if (answerParts.length != 2) {
    throw new Error("Failed to parse the LLM response");
  }
  return answerParts[1];
}

app.post("/predict", async (req, res) => {
  try {
    const inputPayload = generateFormattedString(req.body.messages);
    const command = new InvokeEndpointCommand({
      EndpointName: process.env.SAGEMAKER_ENDPOINT_NAME,
      ContentType: "application/json",
      Body: JSON.stringify({ inputs: inputPayload }),
    });
    const data = await client.send(command);
    return res.json({
      generatedText: parseResponse(data),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error invoking SageMaker endpoint" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
