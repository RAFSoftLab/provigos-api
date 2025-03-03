import { googleClientId } from "./config";

const { OAuth2Client } = require("google-auth-library");

export async function verifyGoogleToken(req) {
  try {
    const rawToken = req.headers.get("Authorization");
    const token = rawToken?.includes("Bearer ")
      ? rawToken.replace("Bearer ", "")
      : rawToken;

    if (!token) {
      throw "Missing authorization token";
    }

    const client = new OAuth2Client(googleClientId);
    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: googleClientId, // Ensure this matches your client ID
    });

    // Extract payload (user info)
    const payload = ticket.getPayload();

    // Example fields from the payload:
    return {
      userId: payload.sub, // Unique Google user ID
      email: payload.email,
      name: payload.name,
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid ID Token");
  }
}
