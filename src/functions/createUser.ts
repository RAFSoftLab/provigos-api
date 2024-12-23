import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { createItem, getItems } from "./common/db";
const bcrypt = require("bcrypt");

const CONTAINER_NAME = "Users";

export async function createUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    if (request.method === "POST") {
      const userData = await getItems(CONTAINER_NAME);
      const { username, password } = (await request.json()) as {
        username: string;
        password: string;
      };

      if (!username || !password) {
        throw "Missing password or username";
      }

      if (userData.find((user) => user.username === username)) {
        throw "User already exists with that Username";
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const response = createItem(CONTAINER_NAME, {
        username: username,
        password: hashedPassword,
      });

      return {
        jsonBody: response,
      };
    }
  } catch (error) {
    context.log(error);
    return {
      status: 500,
      jsonBody: error,
    };
  }
  return {
    status: 500,
    jsonBody: "Something wrong happened",
  };
}

app.http("createUser", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createUser,
});
