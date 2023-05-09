import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Site,
  ApiGatewayResources,
  DynamoDbResources,
  KDSResources,
} from './index';

export class ReactWebsocketReaderForKdsStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const dynamoDbResources = new DynamoDbResources(this, 'DynamoDbResources');
    const kdsResources = new KDSResources(this, 'KDSResources');

    const apiGatewayResources = new ApiGatewayResources(
      this,
      'ApiGatewayResources',
      {
        kinesisDataStream: kdsResources.kinesisDataStream,
        connectionTable: dynamoDbResources.connectionTable,
      },
    );

    const site = new Site(this, 'Site', {
      kinesisDataStream: kdsResources.kinesisDataStream,
      connectionTable: dynamoDbResources.connectionTable,
      webSocketApi: apiGatewayResources.webSocketApi,
      webSocketStage: apiGatewayResources.webSocketStage,
    });

    new CfnOutput(this, 'siteBucket', { value: site.siteBucket.bucketName });
    new CfnOutput(this, 'distribution', {
      value: site.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'webSocketApi', {
      value: apiGatewayResources.webSocketApi.apiEndpoint,
    });
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new ReactWebsocketReaderForKdsStack(app, 'react-websocket-reader-for-kds', {
  env: devEnv,
});

app.synth();
