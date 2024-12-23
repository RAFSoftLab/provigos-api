import { HttpRequest } from "@azure/functions";
import { jwtSecret } from "./config";

const jwt = require("jsonwebtoken");

export const verifyToken = (req: HttpRequest) => {
  const rawToken = req.headers.get("Authorization");
  const token = rawToken?.includes("Bearer ")
    ? rawToken.replace("Bearer ", "")
    : rawToken;

  if (!token) {
    throw "Missing authorization token";
  }

  const decodedToken = jwt.verify(token, jwtSecret);
  console.log(decodedToken);
  const { userId, username } = decodedToken;
  return { userId, username };
};
