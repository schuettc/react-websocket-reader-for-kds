/* eslint-disable import/no-extraneous-dependencies */
import { execSync, ExecSyncOptions } from 'child_process';
import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { RemovalPolicy, DockerImage } from 'aws-cdk-lib';
import {
  Distribution,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
  CachePolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Stream } from 'aws-cdk-lib/aws-kinesis';
import { Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Source, BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as fsExtra from 'fs-extra';

interface SiteProps {
  kinesisDataStream: Stream;
  connectionTable: Table;
  webSocketApi: WebSocketApi;
  webSocketStage: WebSocketStage;
}

export class Site extends Construct {
  public siteBucket: Bucket;
  public distribution: Distribution;

  constructor(scope: Construct, id: string, props: SiteProps) {
    super(scope, id);

    this.siteBucket = new Bucket(this, 'websiteBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      encryption: BucketEncryption.S3_MANAGED,
    });

    this.distribution = new Distribution(this, 'CloudfrontDistribution', {
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new S3Origin(this.siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    const execOptions: ExecSyncOptions = { stdio: 'inherit' };

    const bundle = Source.asset('./site', {
      bundling: {
        command: [
          'sh',
          '-c',
          'echo "Docker build not supported. Please install esbuild."',
        ],
        image: DockerImage.fromRegistry('alpine'),
        local: {
          /* istanbul ignore next */
          tryBundle(outputDir: string) {
            try {
              execSync('esbuild --version', execOptions);
            } catch {
              return false;
            }
            execSync(
              'cd site && yarn install --frozen-lockfile && yarn build',
              execOptions,
            );
            fsExtra.copySync('./site/dist', outputDir);
            return true;
          },
        },
      },
    });

    const config = {
      kinesisDataStreamName: props.kinesisDataStream.streamName,
      connectionTable: props.connectionTable.tableName,
      webSocketUrl: props.webSocketApi.apiEndpoint,
      webSocketStage: props.webSocketStage.stageName,
    };

    new BucketDeployment(this, 'DeployBucket', {
      sources: [bundle, Source.jsonData('config.json', config)],
      destinationBucket: this.siteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });
  }
}
