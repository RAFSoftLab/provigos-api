import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItems } from "./common/db";
import { jwtSecret, jwtTimeout } from "./common/config";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const CONTAINER_NAME = "Users";

export async function login(
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

      const user = userData.find((user) => user.username === username);
      if (!user) {
        throw "Username doesnt exist.";
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        throw "Wrong password";
      }

      const token = jwt.sign(
        { userId: user.id, username: username },
        jwtSecret,
        {
          expiresIn: jwtTimeout,
        }
      );
      return {
        jsonBody: token,
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

app.http("login", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: login,
});
