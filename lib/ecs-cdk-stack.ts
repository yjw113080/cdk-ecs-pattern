import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';


export class EcsCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, 'ecs-vpc');
    const cluster = new ecs.Cluster(this, 'ecs', {
      vpc,
      containerInsights: true
    });
    
    // Create s3 bucket to store logs
    const bucket = new s3.Bucket(this, 'LogBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    
    const firehoseRole = new iam.Role(this, 'firehoseRole', { 
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
      inlinePolicies: {
        'allow-s3-kinesis-logs': new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "kinesis:DescribeStream",
                        "kinesis:DescribeStreamSummary",
                        "kinesis:GetRecords",
                        "kinesis:GetShardIterator",
                        "kinesis:ListShards",
                        "kinesis:SubscribeToShard"
                    ],
                    resources: ['*']
                }),
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "s3:GetObject*",
                        "s3:GetBucket*",
                        "s3:List*",
                        "s3:DeleteObject*",
                        "s3:PutObject*",
                        "s3:Abort*"
                    ],
                    resources: [
                        bucket.bucketArn,
                        bucket.bucketArn + "/*"
                    ]
                }),
                // new iam.PolicyStatement({
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         "logs:PutLogEvents"
                //     ],
                //     resources: [
                //         logGroup.logGroupArn
                //     ]
                // })
            ]
        })
    }
    });
    
    
    
    const stream = new firehose.CfnDeliveryStream(this, 'KinesisToS3', {
      deliveryStreamName: 'ecs-firelens',
      s3DestinationConfiguration: {
        bucketArn: bucket.bucketArn,
        roleArn: firehose,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1
        },
        // cloudWatchLoggingOptions: {
        //   enabled: true,
        //   logGroupName: "firehose_log",
        //   logStreamName: "S3delivery"
        // },
        compressionFormat: "UNCOMPRESSED",
        prefix: "json-data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/",
        errorOutputPrefix: "error-json/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/!{firehose:error-output-type}"
      }
    })

    
    const fargateSvc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ecs-service', {
      cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
        logDriver: ecs.LogDrivers.firelens({
          options: {
            Name: 'firehose',
            region: cdk.Stack.of(this).region,
            delivery_stream: stream.deliveryStreamName
          }
        })
      },
    });
    
    fargateSvc.targetGroup.configureHealthCheck({
      path: "/custom-health-path",
    });
    
    fargateSvc.taskDefinition.addFirelensLogRouter('ecs-firelens', {
      image: ecs.obtainDefaultFluentBitECRImage(fargateSvc.taskDefinition, fargateSvc.taskDefinition.defaultContainer?.logDriverConfig),
      firelensConfig: {
        type: ecs.FirelensLogRouterType.FLUENTBIT
      }
    })
  }
}
