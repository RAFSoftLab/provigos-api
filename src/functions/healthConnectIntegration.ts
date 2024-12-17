//@ts-ignore
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getItems, updateItem } from "./common/db";

type healthValue = {
  id: string;
  userId: string;
  value: {
    [valueType: string]: {
      [dateValue: string]: string;
    };
  };
};

const CONTAINER_NAME = "HealthConnectIntegration";

export async function healthConnectIngetration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const userId = request.query.get("userId");

  try {
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
      const userData = allUserHealthConnectData.find(
        (userData) => userData.userId === userId
      );

      if (!userData) {
        throw "No such user found with id: " + userId;
      }
      const oldValues = userData.values;

      const data = await request.json();

      const cosmosResponse = await updateItem(CONTAINER_NAME, {
        ...userData,
        values: data,
      });
      //@ts-ignore
      // const newValues = Object.entries(data).reduce(
      //   ([valueType, valueDatePair], acc) => {
      //     acc[valueType] = {
      //       ...acc[valueType],
      //       ...valueDatePair,
      //     };
      //     return acc;
      //   },
      //   oldValues
      // );
      // console.log(newValues);
      return cosmosResponse;
    }
  } catch (error) {
    context.log(error);
    return error;
  }
}

app.http("healthConnectIngetration", {
  methods: ["GET", "POST"],
  authLevel: "function",
  handler: healthConnectIngetration,
});
