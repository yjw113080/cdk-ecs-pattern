import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';

export class EcsCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, 'ecs-vpc');
    
    const cluster = new ecs.Cluster(this, 'ecs', {
      vpc,
      containerInsights: true
    });
    
    const repo = new ecr.Repository(this, 'DemoRepo');
    
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
        // prefix: "json-data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/",
        errorOutputPrefix: "error-log/dt=!{timestamp:yyyy-MM-dd}/"
      }
    })
    
    
    const ftkSvc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'petclinic-service', {
      cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(repo),
        containerPort: 8080,
        logDriver: ecs.LogDrivers.firelens({
          options: {
            Name: 'firehose',
            region: cdk.Stack.of(this).region,
            delivery_stream: stream.deliveryStreamName!
          }
        })
      },
    });
    
    ftkSvc.taskDefinition.addFirelensLogRouter('ecs-firelens', {
      image: ecs.obtainDefaultFluentBitECRImage(ftkSvc.taskDefinition, ftkSvc.taskDefinition.defaultContainer?.logDriverConfig),
      firelensConfig: {
        type: ecs.FirelensLogRouterType.FLUENTBIT
      },
      logging: new ecs.AwsLogDriver({streamPrefix: 'firelens'})
    })  
    

  }
}
