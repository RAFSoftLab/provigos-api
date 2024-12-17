import { Container, CosmosClient, Database, ItemDefinition, ItemResponse, OperationInput } from "@azure/cosmos";
import { Context } from "vm";
import { cosmosDbName, cosmosEndpoint, cosmosKey } from "./config";
import { BatchResponse } from "./types";

export const getDatabase = (): Database => {
    const cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      key: cosmosKey,
    });
    return cosmosClient.database(cosmosDbName);
  };
  
  export const getContainer = (name: string): Container => {
    const database = getDatabase();
    return database.container(name);
  };
  
  export const createContainer = async (name: string): Promise<Container> => {
    const database = getDatabase();
    const newContainer = await database.containers.createIfNotExists({
      id: name,
    });
    return newContainer?.container;
  };
  
  export const getItems = async (
    containerName: string
  ): Promise<ItemDefinition[]> => {
    const container = getContainer(containerName);
    const response = await container.items.readAll().fetchAll();
    return response.resources;
  };
  
  export const createItem = async (
    containerName: string,
    item: any
  ): Promise<ItemDefinition> => {
    const container = getContainer(containerName);
    const response = await container.items.create(item);
    return response.resource;
  };
  
  export const getItem = async (
    containerName: string,
    itemId: string
  ): Promise<ItemDefinition> => {
    const container = getContainer(containerName);
    const response = await container.item(itemId, itemId).read();
    return response.resource;
  };
  
  export const updateItem = async (
    containerName: string,
    item: any
  ): Promise<any> => {
    const container = getContainer(containerName);
    const response = await container.items.upsert(item);
    return response.resource;
  };
  
  export const deleteItem = async (
    containerName: string,
    id: string
  ): Promise<ItemResponse<any>> => {
    const container = getContainer(containerName);
    return await container.item(id, id).delete();
  };
  
  const executeOperations = async (
    containerName: string,
    operations: OperationInput[],
    context?: Context
  ): Promise<BatchResponse> => {
    let sucessfulOperationsCount = 0;
    let failedOperationsCount = 0;
  
    for (const operation of operations) {
      try {
        const { operationType } = operation;
        if (operationType === "Create") {
          await createItem(containerName, operation.resourceBody);
        } else if (operationType === "Replace" || operationType === "Upsert") {
          await updateItem(containerName, operation.resourceBody);
        } else if (operationType === "Delete") {
          await deleteItem(containerName, operation.id);
        } else {
          context?.log(
            `Error: Operation '${operationType}' implementation not supported!`
          );
          failedOperationsCount += 1;
          continue;
        }
        sucessfulOperationsCount += 1;
      } catch (error) {
        failedOperationsCount += 1;
        context?.log("Error: ", JSON.stringify(error, null, 2));
      }
    }
    return {
      summary: {
        totalOperationsCount: operations?.length,
        sucessfulOperationsCount,
        failedOperationsCount,
      },
    };
  };
  
  export const updateItemsBatch = async (
    containerName: string,
    items: any[],
    context?: Context
  ): Promise<BatchResponse> => {
    const operations: OperationInput[] = items.map((item) => {
      return {
        id: item.id,
        operationType: "Replace",
        resourceBody: item,
      };
    });
  
    return await executeOperations(containerName, operations, context);
  };
  
  export const createItemsBatch = async (
    containerName: string,
    items: any[],
    context?: Context
  ): Promise<BatchResponse> => {
    context?.log(`Creating items in container ${containerName}.`);
    const operations: OperationInput[] = items.map((item) => {
      return {
        operationType: "Create",
        resourceBody: item,
      };
    });
    return await executeOperations(containerName, operations, context);
  };
  
  export const deleteItemsBatch = async (
    containerName: string,
    context?: Context
  ): Promise<BatchResponse> => {
    context?.log(`Deleting items in container ${containerName}.`);
    const items = await getItems(containerName);
  
    const operations: OperationInput[] = items.map((item) => {
      const { id } = item;
      return {
        id,
        operationType: "Delete",
        partitionKey: id,
      };
    });
    return await executeOperations(containerName, operations, context);
  };
  
  export const overwriteItems = async (
    containerName: string,
    newItems: any[],
    context?: Context
  ): Promise<BatchResponse> => {
    context?.log(`Overwriting items in container ${containerName}.`);
    const oldItems = await getItems(containerName);
  
    const oldItemsIds = new Set(oldItems.map((item) => item.id));
    const newItemsIds = new Set(newItems.map((item) => item.id));
  
    const updateOperations: OperationInput[] = newItems.map((item) => {
      const { id } = item;
      const itemShouldBeReplaced = oldItemsIds.has(id);
      return {
        id,
        operationType: itemShouldBeReplaced ? "Replace" : "Create",
        resourceBody: item,
      };
    });
  
    const deleteOperations: OperationInput[] = Array.from(oldItemsIds)
      .filter((id) => !newItemsIds.has(id))
      .map((id) => ({
        id,
        operationType: "Delete",
        partitionKey: id,
      }));
  
    const operations: OperationInput[] = [
      ...updateOperations,
      ...deleteOperations,
    ];
  
    return await executeOperations(containerName, operations, context);
  };
  
  export const overwriteContainer = async (
    containerName,
    overwriteWithContainerName,
    context?: Context
  ): Promise<BatchResponse> => {
    const newItems = await getItems(overwriteWithContainerName);
    return await overwriteItems(containerName, newItems, context);
  };
  
  export const getContainersNames = async (): Promise<string[]> => {
    return (await getDatabase().containers.readAll().fetchAll()).resources.map(
      (container) => container.id
    );
  };