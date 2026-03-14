import { loadEnv } from "@workspace/config";

const env = loadEnv();

import app from "./app";
import { startConsumers } from "./extraction-consumer.js";

const port = env.PORT || Number(process.env["PORT"]) || 8080;

startConsumers();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
