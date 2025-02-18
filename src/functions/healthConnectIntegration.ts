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

type healthValue = {
  id: string;
  userId: string;
  value: {
    [valueType: string]: {
      [dateValue: string]: string;
    };
  };
};

const validIntegrationFields = [
  "steps",
  "weight",
  "caloriesBurned",
  "leanBodyMass",
  "heartRate",
  "bloodPressure",
  "bodyTemperature",
  "bodyFat",
  "height",
];

const validateInputBody = (inputBody) => {
  for (const value of Object.keys(inputBody)) {
    if (!validIntegrationFields.includes(value)) {
      throw `Integration Value is not supported: ${value}`;
    }

    for (const dateValue of Object.keys(inputBody[value])) {
      if (!isMatch(dateValue, "yyyy-MM-dd")) {
        throw `${dateValue} date not formated correctly: YYYY-MM-DD`;
      }
      if (!Number.isInteger(inputBody[value][dateValue])) {
        throw `${inputBody[value][dateValue]} is not a number`;
      }
    }
  }
  //TODO add validation HTTP errors
};

const CONTAINER_NAME = "HealthConnectIntegration";

export async function healthConnectIntegration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    //Username not used from token
    const { userId, email } = await verifyGoogleToken(request);

    if (request.method === "GET") {
      const allUserHealthConnectData = await getItems(CONTAINER_NAME);
      const userIntegrationData = allUserHealthConnectData.find(
        (userData) => userData.email === email
      );
      if (!userIntegrationData) {
        throw "No such user found with email: " + email;
      }

      const decryptedOldValues = JSON.parse(
        decryptData(
          {
            encryptedData: userIntegrationData.values,
            authTag: userIntegrationData.authTag,
            iv: userIntegrationData.iv,
          },
          userId
        )
      );
      return {
        jsonBody: decryptedOldValues,
      };
    } else if (request.method === "POST") {
      const allUserHealthConnectData = await getItems(CONTAINER_NAME);
      let userIntegrationData = allUserHealthConnectData.find(
        (userData) => userData.email === email
      );

      const newValues = (await request.json()) as any;
      validateInputBody(newValues);

      if (!userIntegrationData) {
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
            encryptedData: userIntegrationData.values,
            authTag: userIntegrationData.authTag,
            iv: userIntegrationData.iv,
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

      const encryptedData = encryptData(JSON.stringify(newValues), userId);

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userIntegrationData,
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

app.http("healthConnectIntegration", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: healthConnectIntegration,
});
