import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import { InfraProps } from './infra-stack';


/*
    Example for Stack seperation
*/
export class EcsSvcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: InfraProps) {
    super(scope, id, props);

    
    const svc = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'demo-service', {
      cluster: props?.cluster,
      memoryLimitMiB: 1024,
      cpu: 512,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props?.ecrRepository!),
        // image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
        containerPort: 8080,
        logDriver: ecs.LogDrivers.firelens({
          options: {
            Name: 'firehose',
            region: cdk.Stack.of(this).region,
            delivery_stream: props?.stream.deliveryStreamName!
          }
        })
      },
    });
    
    svc.taskDefinition.addFirelensLogRouter('ecs-firelens', {
      image: ecs.obtainDefaultFluentBitECRImage(svc.taskDefinition, svc.taskDefinition.defaultContainer?.logDriverConfig),
      firelensConfig: {
        type: ecs.FirelensLogRouterType.FLUENTBIT
      },
      logging: new ecs.AwsLogDriver({streamPrefix: 'firelens'})
    })  
    

  }
}
