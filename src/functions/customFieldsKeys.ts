//@ts-ignore
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItems, updateItem } from "./common/db";
import { verifyGoogleToken } from "./common/googleToken";

//TODO Add desc
type CustomField = {
  name: string;
  unit: string;
  label: string;
};

const validateInputBody = (inputBody) => {
  if (!Array.isArray(inputBody.customFields)) {
    throw "Custom fields must be an array";
  }
};

const CONTAINER_NAME = "Users";

export async function customFieldsKeys(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const { userId, email } = await verifyGoogleToken(request);

    if (request.method === "GET") {
      const allUsers = await getItems(CONTAINER_NAME);
      let userData = allUsers.find((userData) => userData.email === email);
      if (!userData) {
        throw "No such user found with email: " + email;
      }
      return {
        jsonBody: userData.customFields,
      };
    } else if (request.method === "POST") {
      const allUsers = await getItems(CONTAINER_NAME);
      let userData = allUsers.find((userData) => userData.email === email);

      const inputBody = (await request.json()) as any;
      validateInputBody(inputBody);
      const newCustomFieldKeys = inputBody.customFields;

      if (!userData) {
        await updateItem(CONTAINER_NAME, {
          email: email,
          customFields: newCustomFieldKeys,
        });

        return {
          jsonBody: "Created user with customFieldKeys for google email.",
        };
      }

      const oldValues = userData.customFields;
      if (!oldValues.customFields) {
        oldValues.customFields = [];
      }

      const returnValue = [
        ...oldValues,
        ...newCustomFieldKeys.filter(
          (key) => !oldValues.find((oldValue) => oldValue.name === key.name)
        ),
      ];

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userData,
        customFields: returnValue,
      });
      return {
        jsonBody: "Updated user data with custom fields",
      };
    } else if (request.method === "DELETE") {
      const allUsers = await getItems(CONTAINER_NAME);
      let userData = allUsers.find((userData) => userData.email === email);
      if (!userData) {
        throw "No such user found with email: " + email;
      }

      const inputBody = (await request.json()) as any;
      validateInputBody(inputBody);
      const newCustomFieldKeys = inputBody.customFields;

      const oldValues = userData.customFields;
      if (!oldValues.customFields) {
        oldValues.customFields = [];
      }

      const returnValue = [
        ...oldValues.filter(
          (oldValue) =>
            !newCustomFieldKeys.find(
              (incomingValue) => oldValue.name === incomingValue.name
            )
        ),
      ];

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userData,
        customFields: returnValue,
      });
      return {
        jsonBody: "Updated user data, deleted selected fields",
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

//TODO Add delete
app.http("customFieldsKeys", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "anonymous",
  handler: customFieldsKeys,
});
