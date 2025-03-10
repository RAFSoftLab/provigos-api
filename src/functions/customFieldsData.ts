//@ts-ignore
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { createItem, getItems, updateItem } from "./common/db";
import { verifyToken } from "./common/token";
import { isMatch } from "date-fns";
import { verifyGoogleToken } from "./common/googleToken";
import { decryptData, encryptData } from "./common/encryption";

const validateInputBody = async (inputBody, email) => {
  const allUsers = await getItems("Users");
  let userData = allUsers.find((userData) => userData.email === email);
  if (!userData) {
    throw "No such user found with email: " + email;
  }

  for (const value of Object.keys(inputBody)) {
    if (
      !userData.customFields.find((customField) => customField.name === value)
    ) {
      throw `Integration Value is not supported: ${value}`;
    }
  }
  //TODO add validation HTTP errors
};

const CONTAINER_NAME = "CustomFieldsData";

export async function customFieldsData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    //Username not used from token
    const { userId, email } = await verifyGoogleToken(request);

    if (request.method === "GET") {
      const allUserCustomFieldsData = await getItems(CONTAINER_NAME);
      const userCustomFieldsData = allUserCustomFieldsData.find(
        (userData) => userData.email === email
      );
      if (!userCustomFieldsData) {
        throw "No such user found with email: " + email;
      }

      const decryptedOldValues = JSON.parse(
        decryptData(
          {
            encryptedData: userCustomFieldsData.values,
            authTag: userCustomFieldsData.authTag,
            iv: userCustomFieldsData.iv,
          },
          userId
        )
      );
      return {
        jsonBody: decryptedOldValues,
      };
    } else if (request.method === "POST") {
      const allUserCustomFieldsData = await getItems(CONTAINER_NAME);
      let userCustomFieldsData = allUserCustomFieldsData.find(
        (userData) => userData.email === email
      );

      const newValues = (await request.json()) as any;
      //validateInputBody(newValues);

      if (!userCustomFieldsData) {
        const encryptedData = encryptData(JSON.stringify(newValues), userId);

        await updateItem(CONTAINER_NAME, {
          email: email,
          values: encryptedData.encryptedData,
          iv: encryptedData.iv,
          authTag: encryptedData.authTag,
        });

        return {
          jsonBody: "Created integration for email.",
        };
      }

      const decryptedOldValues = JSON.parse(
        decryptData(
          {
            encryptedData: userCustomFieldsData.values,
            authTag: userCustomFieldsData.authTag,
            iv: userCustomFieldsData.iv,
          },
          userId
        )
      );

      for (const [key, object] of Object.entries(newValues)) {
        console.log(key, object);
        decryptedOldValues[key] = {
          ...decryptedOldValues[key],
          ...newValues[key],
        };
      }

      const encryptedData = encryptData(
        JSON.stringify(decryptedOldValues),
        userId
      );

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userCustomFieldsData,
        values: encryptedData.encryptedData,
        iv: encryptedData.iv,
        authTag: encryptedData.authTag,
      });
      return {
        jsonBody: "Updated integration data",
      };
    }
  } catch (error) {
    context.log(error);
    return {
      status: 500,
      jsonBody: error,
    };
  }
}

app.http("customFieldsData", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: customFieldsData,
});
