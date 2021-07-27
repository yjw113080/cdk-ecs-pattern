#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EcsCdkStack } from '../lib/ecs-cdk-stack';
import { EcsSvcStack } from '../lib/ecs-svc-stack';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();
// new EcsCdkStack(app, 'EcsCdkStack');


const infraStack = new InfraStack(app, 'InfraStack');
new EcsSvcStack(app, 'EcsSvcStack', {
  // vpc: infraStack.vpc,
  ecrRepository: infraStack.ecrRepository,
  cluster: infraStack.cluster,
  stream: infraStack.firehoseStream
});
