import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  Table,
  BillingMode,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DynamoDbResources extends Construct {
  public connectionTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.connectionTable = new Table(this, 'connectionTable', {
      partitionKey: {
        name: 'connectionId',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'TTL',
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  }
}
