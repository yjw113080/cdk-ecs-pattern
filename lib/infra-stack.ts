import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';


/*
    Example for Stack seperation
*/
export class InfraStack extends cdk.Stack {

    public readonly cluster: ecs.Cluster;
    public readonly ecrRepository: ecr.Repository;
    public readonly firehoseStream: firehose.CfnDeliveryStream;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, 'ecs-vpc');
    
    const cluster = new ecs.Cluster(this, 'ecs', {
      vpc,
      containerInsights: true
    });
    
    const ecrRepo = new ecr.Repository(this, 'DemoRepo');
    
    // Create s3 bucket to store logs
    const bucket = new s3.Bucket(this, 'LogBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    
    const firehoseRole = new iam.Role(this, 'firehoseRole', { 
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com")
    });
    bucket.grantReadWrite(firehoseRole)
    
    const firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogGroup');
    const firehoseLogStream = new logs.LogStream(this, 'FirehoseLogStream', { logGroup: firehoseLogGroup });
    
    const stream = new firehose.CfnDeliveryStream(this, 'KinesisToS3', {
      deliveryStreamName: 'ecs-firelens',
      deliveryStreamType: 'DirectPut',
      s3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: firehoseLogGroup.logGroupName,
          logStreamName: firehoseLogStream.logStreamName
        },
        compressionFormat: "UNCOMPRESSED",
        prefix: "log/dt=!{timestamp:yyyy-MM-dd}/",
        errorOutputPrefix: "error-log/dt=!{timestamp:yyyy-MM-dd}/"

      }
    })

    this.cluster = cluster;
    this.ecrRepository = ecrRepo;
    this.firehoseStream = stream;

  }
}

export interface InfraProps extends cdk.StackProps {
    cluster: ecs.Cluster,
    ecrRepository: ecr.Repository,
    stream: firehose.CfnDeliveryStream
}