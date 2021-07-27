import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import { InfraProps } from './infra-stack';


/*
    Example for Stack seperation
*/
export class EcsSvcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: InfraProps) {
    super(scope, id, props);


    // Task Definition
    const td = new ecs.FargateTaskDefinition(this, 'TaskDefn', {
      family: 'FoodtechDemo',
      cpu: 512,
      memoryLimitMiB: 1024      
    })

    td.addContainer('App', {
      image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository),
      portMappings: [{
        containerPort: 8080
      }],
      logging: ecs.LogDrivers.firelens({
        options: {
          Name: 'firehose',
          region: cdk.Stack.of(this).region,
          delivery_stream: props.stream.deliveryStreamName!
        }
      })
    })

    td.addFirelensLogRouter('Firelens', {
      image: ecs.obtainDefaultFluentBitECRImage(td, td.defaultContainer?.logDriverConfig),
      firelensConfig: { type: ecs.FirelensLogRouterType.FLUENTBIT }
    }) 
    

  }
}
