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
};

const CONTAINER_NAME = "HealthConnectIntegration";

export async function healthConnectIntegration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const { userId, username } = verifyToken(request);

    if (request.method === "GET") {
      const allUserHealthConnectData = await getItems(CONTAINER_NAME);
      const userData = allUserHealthConnectData.find(
        (userData) => userData.userId === userId
      );
      if (!userData) {
        throw "No such user found with id: " + userId;
      }
      return {
        jsonBody: userData.values,
      };
    } else if (request.method === "POST") {
      const allUserHealthConnectData = await getItems(CONTAINER_NAME);
      let userIntegrationData = allUserHealthConnectData.find(
        (userData) => userData.userId === userId
      );

      if (!userIntegrationData) {
        userIntegrationData = {
          userId: userId,
          values: {},
        };
        createItem(CONTAINER_NAME, userIntegrationData);
      }
      const oldValues = userIntegrationData.values;

      const newValues = await request.json();
      validateInputBody(newValues);

      for (const [key, object] of Object.entries(newValues)) {
        console.log(key, object);
        oldValues[key] = {
          ...oldValues[key],
          ...newValues[key],
        };
      }

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userIntegrationData,
        values: newValues,
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
