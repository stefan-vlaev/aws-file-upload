const cdk = require('aws-cdk-lib');
const { Bucket } = require('aws-cdk-lib/aws-s3');
const { Table, AttributeType } = require('aws-cdk-lib/aws-dynamodb');
const { Function, Code, Runtime } = require('aws-cdk-lib/aws-lambda');
const { RestApi, LambdaIntegration } = require('aws-cdk-lib/aws-apigateway');
const { Email } = require('aws-cdk-lib/aws-ses');

class AwsFileUploadStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create S3 bucket for file uploads
    const bucket = new Bucket(this, 'FileUploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development/testing
    });

    // Create DynamoDB table for storing metadata
    const table = new Table(this, 'FileMetadata', {
      partitionKey: { name: 'fileName', type: AttributeType.STRING },
      sortKey: { name: 'uploadDate', type: AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda function for processing uploads
    const lambdaFunction = new Function(this, 'FileUploadFunction', {
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler.handler',
      code: Code.fromAsset('lambda'), // Points to the "lambda" directory
      environment: {
        BUCKET_NAME: bucket.bucketName,
        TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda permissions to access S3 and DynamoDB
    bucket.grantReadWrite(lambdaFunction);
    table.grantWriteData(lambdaFunction);

    // Create API Gateway to trigger Lambda
    const api = new RestApi(this, 'FileUploadAPI', {
      restApiName: 'File Upload Service',
    });
    const fileUploadResource = api.root.addResource('upload');
    fileUploadResource.addMethod('POST', new LambdaIntegration(lambdaFunction));

    // SES Email configuration
    new Email(this, 'FileUploadNotificationEmail', {
      emailAddress: 'hristo.zhelev@yahoo.com',
    });
  }
}

module.exports = { AwsFileUploadStack };
