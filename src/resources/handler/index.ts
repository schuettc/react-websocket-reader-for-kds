/* eslint-disable import/no-extraneous-dependencies */
import { TextEncoder } from 'util';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocument,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Handler, APIGatewayProxyEvent, KinesisStreamEvent } from 'aws-lambda';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocument.from(ddbClient);
const apiGatewayManagementApi = new ApiGatewayManagementApiClient({
  apiVersion: '2018-11-29',
  endpoint: process.env.API_GATEWAY_ENDPOINT,
});

function isAPIGatewayProxyEvent(event: any): event is APIGatewayProxyEvent {
  return event.requestContext !== undefined;
}

function isKinesisStreamEvent(event: any): event is KinesisStreamEvent {
  return event.Records !== undefined && event.Records[0]?.kinesis !== undefined;
}

export const handler: Handler = async (event) => {
  if (isAPIGatewayProxyEvent(event)) {
    // WebSocket connection and disconnection handling
    const connectionId = event.requestContext.connectionId;
    console.log('endpoint:  ' + process.env.API_GATEWAY_ENDPOINT);

    if (event.requestContext.eventType === 'CONNECT') {
      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.CONNECTION_TABLE,
          Item: { connectionId },
        }),
      );
      return { statusCode: 200 };
    } else if (event.requestContext.eventType === 'DISCONNECT') {
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: process.env.CONNECTION_TABLE,
          Key: { connectionId },
        }),
      );
      return { statusCode: 200 };
    }
  } else if (isKinesisStreamEvent(event)) {
    // Kinesis Data Stream processing
    for (const record of event.Records) {
      const kinesisData = Buffer.from(record.kinesis.data, 'base64').toString(
        'utf8',
      );
      console.log('Kinesis Record:', kinesisData);

      const connections = await ddbDocClient.send(
        new ScanCommand({ TableName: process.env.CONNECTION_TABLE }),
      );
      const postData = JSON.parse(kinesisData);

      if (connections.Items) {
        console.log('Connections: ' + JSON.stringify(connections.Items));
        for (const connection of connections.Items) {
          try {
            await apiGatewayManagementApi.send(
              new PostToConnectionCommand({
                ConnectionId: connection.connectionId,
                Data: new TextEncoder().encode(JSON.stringify(postData)),
              }),
            );
          } catch (error) {
            if (
              error instanceof Error &&
              'statusCode' in error &&
              error.statusCode === 410
            ) {
              // Remove stale connections
              await ddbDocClient.send(
                new DeleteCommand({
                  TableName: process.env.CONNECTION_TABLE,
                  Key: { connectionId: connection.connectionId },
                }),
              );
            }
          }
        }
      }
    }
  }

  return {
    statusCode: 200,
  };
};
