import AWS = require('aws-sdk');
import * as https from 'https';

// export for tests
export const codePipeline = new AWS.CodePipeline();

/**
 * Lambda handler for the codepipeline state change events
 *
 * {
 *     "version": "0",
 *     "id": event_Id,
 *     "detail-type": "CodePipeline Pipeline Execution State Change",
 *     "source": "aws.codepipeline",
 *     "account": Pipeline_Account,
 *     "time": TimeStamp,
 *     "region": "us-east-1",
 *     "resources": [
 *         "arn:aws:codepipeline:us-east-1:account_ID:myPipeline"
 *     ],
 *     "detail": {
 *         "pipeline": "myPipeline",
 *         "version": "1",
 *         "state": "STARTED",
 *         "execution-id": execution_Id
 *     }
 * }
 */
export async function handler(event: any) {
  // Log the event so we can have a look in CloudWatch logs
  process.stdout.write(`${JSON.stringify(event)}\n`);

  const webhookUrlsVar = process.env.WEBHOOK_URLS;
  if (!webhookUrlsVar) { throw new Error("Expect environment variable 'WEBHOOK_URLS'"); }
  const webhookUrls = webhookUrlsVar.split('|');

  const details = event.detail || {};
  const pipelineName = details.pipeline;
  const pipelineExecutionId = details['execution-id'];

  if (!pipelineName || !pipelineExecutionId) {
    process.stderr.write(`Malformed event!`);
    return;
  }

  // Describe the revision that caused the pipeline to fail
  const response = await codePipeline.getPipelineExecution({ pipelineName, pipelineExecutionId }).promise();
  process.stdout.write(JSON.stringify(response));
  const firstArtifact: AWS.CodePipeline.ArtifactRevision | undefined = (response.pipelineExecution?.artifactRevisions ?? [])[0];
  const revisionSummary = firstArtifact?.revisionSummary ?? firstArtifact?.revisionId ?? `execution ${pipelineExecutionId}`;

  const message = `Pipeline '${pipelineName}' failed on '${revisionSummary}'`;

  // Post the failure to all given Chime webhook URLs
  await Promise.all(webhookUrls.map(url => sendChimeNotification(url, message)));
}

async function sendChimeNotification(url: string, message: string) {
  return new Promise((ok, ko) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        ko(new Error(`Server responded with ${res.statusCode}: ${JSON.stringify(res.headers)}`));
      }

      res.setEncoding('utf8');
      res.on('data', () => { /* gobble gobble and ignore */ });
      res.on('error', ko);
      res.on('end', ok);
    });

    req.on('error', ko);
    req.write(JSON.stringify({"Content": message}));
    req.end();
  });
}