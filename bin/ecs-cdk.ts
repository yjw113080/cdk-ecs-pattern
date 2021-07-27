#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {InfraStack} from '../lib/infra-stack';
import {EcsSvcStack} from '../lib/ecs-svc-stack';

const app = new cdk.App();

const infra = new InfraStack(app, 'InfraStack');
const ecsSvc = new EcsSvcStack(app, 'EcsSvcStack', {
  ecrRepository: infra.ecrRepository,
  cluster: infra.cluster,
  stream: infra.firehoseStream
})
