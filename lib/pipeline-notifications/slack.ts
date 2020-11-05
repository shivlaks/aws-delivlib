import * as crypto from 'crypto';
import {
  aws_chatbot as chatbot,
  aws_codestarnotifications as starnotifs,
} from 'monocdk';
import { IPipelineNotification, PipelineNotificationBindOptions } from '../';

/**
 * Properties to initialize SlackNotification
 */
export interface SlackNotificationProps {
  /**
   * The list of Chatbot registered slack channels.
   */
  readonly channels: chatbot.SlackChannelConfiguration[];
}

/**
 * Notify events on pipeline to a Slack channel via AWS Chatbot
 */
export class SlackNotification implements IPipelineNotification {
  constructor(private readonly props: SlackNotificationProps) {
    if (this.props.channels.length == 0) {
      throw new Error('channels cannot be empty');
    }
  }

  public bind(options: PipelineNotificationBindOptions): void {
    const targets: starnotifs.CfnNotificationRule.TargetProperty[] = this.props.channels.map(c => {
      return {
        targetAddress: c.slackChannelConfigurationArn,
        targetType: 'AWSChatbotSlack',
      };
    });
    const md5 = crypto.createHash('md5');
    md5.update(JSON.stringify(targets));
    new starnotifs.CfnNotificationRule(options.pipeline, `PipelineNotificationSlack-${md5.digest('hex')}`, {
      name: `${options.pipeline.pipeline.pipelineName}-failednotifications`,
      detailType: 'BASIC',
      resource: options.pipeline.pipeline.pipelineArn,
      targets,
      eventTypeIds: ['codepipeline-pipeline-action-execution-failed'],
    });
  }
}