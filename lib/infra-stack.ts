import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as firehose from '@aws-cdk/aws-kinesisfirehose';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';


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

    const alb = new elb.ApplicationLoadBalancer(this, 'alb', {
      vpc,
      internetFacing: true
    })
    const albProdListener = alb.addListener('albProdListener', {
      port: 80
    });
    const albTestListener = alb.addListener('albTestListener', {
        port: 8080
    });
    albProdListener.connections.allowDefaultPortFromAnyIpv4('Allow traffic from everywhere');
    albTestListener.connections.allowDefaultPortFromAnyIpv4('Allow traffic from everywhere');

    const blueGroup = new elb.ApplicationTargetGroup(this, "blueGroup", {
      vpc: vpc,
      protocol: elb.ApplicationProtocol.HTTP,
      port: 80,
      targetType: elb.TargetType.IP,
      healthCheck: {
          path: "/",
          timeout: cdk.Duration.seconds(10),
          interval: cdk.Duration.seconds(15),
          healthyHttpCodes: "200,404"
      }
  });

  // Target group 2
    const greenGroup = new elb.ApplicationTargetGroup(this, "greenGroup", {
        vpc: vpc,
        protocol: elb.ApplicationProtocol.HTTP,
        port: 80,
        targetType: elb.TargetType.IP,
        healthCheck: {
            path: "/",
            timeout: cdk.Duration.seconds(10),
            interval: cdk.Duration.seconds(15),
            healthyHttpCodes: "200,404"
        }
    });

    // Registering the blue target group with the production listener of load balancer
    albProdListener.addTargetGroups("blueTarget", {
        targetGroups: [blueGroup]
    });

    // Registering the green target group with the test listener of load balancer
    albTestListener.addTargetGroups("greenTarget", {
        targetGroups: [greenGroup]
    });


    // 젠킨스 서버에 추가부여할 롤
    // iam.Role.fromRoleArn("XXXXX").addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"))
    // iam.Role.fromRoleArn("XXXXX").addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployDeployerAccess"))

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