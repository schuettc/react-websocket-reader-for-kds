/* eslint-disable import/no-extraneous-dependencies */
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import {
  Runtime,
  Function,
  Architecture,
  EventSourceMapping,
  StartingPosition,
} from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

interface ApiGatewayResourcesProps {
  kinesisDataStream: Stream;
  connectionTable: Table;
}

export class ApiGatewayResources extends Construct {
  public lambdaHandler: Function;
  public webSocketApi: WebSocketApi;
  public webSocketStage: WebSocketStage;

  constructor(scope: Construct, id: string, props: ApiGatewayResourcesProps) {
    super(scope, id);

    this.webSocketApi = new WebSocketApi(this, 'webSocketApi', {});

    this.webSocketStage = new WebSocketStage(this, 'webSocketStage', {
      webSocketApi: this.webSocketApi,
      stageName: 'dev',
      autoDeploy: true,
    });

    const lambdaHandlerRole = new Role(
      this,
      'voiceCallAnalyticsLambdaSinkRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
        ],
      },
    );
    this.lambdaHandler = new NodejsFunction(this, 'lambdaHandler', {
      entry: 'src/resources/handler/index.ts',
      runtime: Runtime.NODEJS_18_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(60),
      role: lambdaHandlerRole,
      environment: {
        STREAM_NAME: props.kinesisDataStream.streamName,
        CONNECTION_TABLE: props.connectionTable.tableName,
        API_GATEWAY_ENDPOINT: `https://${this.webSocketApi.apiId}.execute-api.${this.webSocketApi.stack.region}.amazonaws.com/${this.webSocketStage.stageName}`,
      },
    });

    props.connectionTable.grantReadWriteData(this.lambdaHandler);
    props.kinesisDataStream.grantReadWrite(this.lambdaHandler);

    new EventSourceMapping(this, 'eventSourceMapping', {
      target: this.lambdaHandler,
      eventSourceArn: props.kinesisDataStream.streamArn,
      startingPosition: StartingPosition.LATEST,
    });

    this.webSocketApi.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration(
        'ConnectIntegration',
        this.lambdaHandler,
      ),
    });
    this.webSocketApi.addRoute('$disconnect', {
      integration: new WebSocketLambdaIntegration(
        'DisconnectIntegration',
        this.lambdaHandler,
      ),
    });
    this.webSocketApi.addRoute('$default', {
      integration: new WebSocketLambdaIntegration(
        'DefaultIntegration',
        this.lambdaHandler,
      ),
    });

    this.webSocketStage.grantManagementApiAccess(this.lambdaHandler);

    this.webSocketApi.grantManageConnections(this.lambdaHandler);
  }
}
