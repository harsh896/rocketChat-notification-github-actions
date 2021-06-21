import * as github from "@actions/github";
import { Context } from "@actions/github/lib/context";
import axios from "axios";
import * as core from "@actions/core";

export interface IncomingWebhookDefaultArguments {
  username: string;
  channel: string;
  icon_emoji: string;
}

// Define Variables
const id: string = core.getInput("id");
const message: string = core.getInput("message");
const userNameWhoTriggeredTheWorkflow: string = core.getInput(
  "userNameWhoTriggeredTheWorkflow"
);
const commitMessage: string = core.getInput("commitMessage");
const commitAuthor: string = core.getInput("commitAuthor");
const commitUrl: string = core.getInput("commitUrl");

interface Accessory {
  color: string;
  result: string;
  emoji: string;
}

class Helper {
  readonly context: Context = github.context;

  public async userNameWhoTriggeredTheWorkflowFlag(): Promise<any> {
    const name: string = userNameWhoTriggeredTheWorkflow;
    const url: string = `https://github.com/${name}`;
    let actionUrl: string = url;

    const value = `[${name}](${actionUrl})`;

    return value;
  }

  public get success(): Accessory {
    return {
      color: "#2cbe4e",
      result: "Succeeded",
      emoji: ":heavy_check_mark:"
    };
  }

  public get failure(): Accessory {
    return {
      color: "#cb2431",
      result: "Failed",
      emoji: ":x:"
    };
  }

  public get cancelled(): Accessory {
    return {
      color: "#ffc107",
      result: "Cancelled",
      emoji: ":exclamation:"
    };
  }

  public get isPullRequest(): boolean {
    const { eventName } = this.context;
    return eventName === "pull_request";
  }

  public get baseFields(): any[] {
    const { sha, eventName, workflow, ref } = this.context;
    const { owner, repo } = this.context.repo;
    const { number } = this.context.issue;
    const repoUrl: string = `https://github.com/${owner}/${repo}`;
    let actionUrl: string = repoUrl;
    let eventUrl: string = eventName;
    //const message: string = message;

    if (this.isPullRequest) {
      eventUrl = `[${eventName}](${repoUrl}/pull/${number})`;
      actionUrl += `/pull/${number}/checks`;
    } else {
      actionUrl += `/commit/${sha}/checks`;
    }

    return [
      {
        short: true,
        title: "ref",
        value: ref
      },
      {
        short: true,
        title: "event name",
        value: eventUrl
      },
      {
        short: true,
        title: "workflow",
        value: `[${workflow}](${actionUrl})`
      },
      {
        short: true,
        title: "repository",
        value: `[${owner}/${repo}](${repoUrl})`
      }
    ];
  }

  public async getMessageFeild(): Promise<any[]> {
    const fields = [
      {
        short: true,
        title: "message",
        value: message
      }
    ];
    return fields;
  }

  public async getCommitFields(): Promise<any[]> {
    const { owner, repo } = this.context.repo;
    const head_ref: string = process.env.GITHUB_HEAD_REF as string;
    const ref: string = this.isPullRequest
      ? head_ref.replace(/refs\/heads\//, "")
      : this.context.sha;
    //const client: github.GitHub = new github.GitHub(token);
    //const {data: commit}: Octokit.Response<Octokit.ReposGetCommitResponse> = await client.repos.getCommit({owner, repo, ref});
    const authorName: string = commitAuthor;
    const authorUrl: string = `https://github.com/${commitAuthor}`;
    const commitMsg: string = commitMessage;
    const commitUrlField: string = commitUrl;
    const fields = [
      {
        short: true,
        title: "commit",
        value: `[${commitMsg}](${commitUrlField})`
      },
      {
        short: true,
        title: "author",
        value: `[${authorName}](${authorUrl})`
      }
    ];
    return fields;
  }
}

export class RocketChat {
  private isMention(condition: string, status: string): boolean {
    return condition === "always" || condition === status;
  }

  public async generatePayload(
    jobName: string,
    status: string,
    mention: string,
    mentionCondition: string,
    commitFlag: boolean,
    //token?: string,
    message?: string
  ): Promise<any> {
    const helper = new Helper();
    const notificationType: Accessory = helper[status];
    const userNameTriggered = await helper.userNameWhoTriggeredTheWorkflowFlag();
    const tmpText: string = `${notificationType.emoji} #${id} ${jobName}  triggered by ${userNameTriggered} -> ${notificationType.result}`;
    const text =
      mention && this.isMention(mentionCondition, status)
        ? `@${mention} ${tmpText}`
        : tmpText;

    const fields = helper.baseFields;

    if (commitFlag) {
      const commitFields = await helper.getCommitFields();
      Array.prototype.push.apply(fields, commitFields);
    }

    if (message) {
      const messageField = await helper.getMessageFeild();
      Array.prototype.push.apply(fields, messageField);
    }

    const attachments = {
      color: notificationType.color,
      fields
    };

    const payload = {
      text,
      attachments: [attachments]
    };

    return payload;
  }

  public async notify(
    url: string,
    options: IncomingWebhookDefaultArguments,
    payload: any
  ): Promise<void> {
    const data = {
      ...options,
      ...payload
    };

    console.info(`
			Generated payload for Rocket.Chat:
			${JSON.stringify(data, null, 2)}
		`);

    const response = await axios.post(url, data);

    console.info(`
			Response:
			${response.data}
		`);

    if (response.status !== 200) {
      throw new Error(`
				Failed to send notification to Rocket.Chat
				Response: ${response.data}
			`);
    }
  }
}
