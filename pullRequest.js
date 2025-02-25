import axios from "axios";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { preCheckRepository } from "./repository.js";
import { fetchBranchesPaginated, getBranches } from "./branch.js";
import { loadConfig, saveConfig } from "./config.js";

// List pull requests
export const listPullRequests = async (
  client,
  config,
  repo,
  state = "OPEN"
) => {
  const spinner = ora("Fetching pull requests...").start();

  try {
    const response = await client.get(
      `/repositories/${config.workspace}/${repo}/pullrequests?pagelen=50`,
      { params: { state } }
    );
    spinner.succeed("Pull requests fetched successfully!");

    if (response.data.values.length === 0) {
      console.log(
        chalk.yellow(`No ${state.toLowerCase()} pull requests found.`)
      );
      return [];
    }

    console.log(chalk.bold(`\n${state} Pull Requests for ${repo}:`));

    response.data.values.forEach((pr) => {
      console.log(
        `${chalk.green("#" + pr.id)} ${chalk.white(pr.title)} ${chalk.blue(
          "(" + pr.source.branch.name + " → " + pr.destination.branch.name + ")"
        )}`
      );
    });

    return response.data.values;
  } catch (error) {
    spinner.fail("Failed to fetch pull requests");
    console.error(
      chalk.red(
        `Error: ${error.response?.data?.error?.message || error.message}`
      )
    );
    return [];
  }
};

// Merge pull request
export const mergePullRequest = async (
  client,
  config,
  repo,
  prId,
  message = ""
) => {
  const spinner = ora("Merging pull request...").start();

  try {
    const response = await client.post(
      `/repositories/${config.workspace}/${repo}/pullrequests/${prId}/merge`,
      {
        merge_strategy: "merge_commit",
        message: message || `Merged pull request #${prId} via CLI`,
      }
    );

    spinner.succeed("Pull request merged successfully!");
    console.log(chalk.green(`Pull request #${prId} has been merged!`));
    return response.data;
  } catch (error) {
    spinner.fail("Failed to merge pull request");
    console.error(
      chalk.red(
        `Error: ${error.response?.data?.error?.message || error.message}`
      )
    );
    return null;
  }
};

export const createPullRequest = async (client, config) => {
  const repo = await preCheckRepository(config);
  let lastUsedConfig = loadConfig();
  let branches = [];
  let sourceBranch = "";
  if (lastUsedConfig.sourceBranch) {
    const { reuseSourceBranches } = await inquirer.prompt([
      {
        type: "confirm",
        name: "reuseSourceBranches",
        message: `Do you want to re-use this resources branches?: ${lastUsedConfig.sourceBranch}`,
        default: true,
      },
    ]);
    if (!reuseSourceBranches) {
      const spinner = ora("Fetching branches...").start();
      branches = await fetchBranchesPaginated(client, config, repo);
      if (branches.length === 0) {
        console.log(chalk.red("No branches found."));
        return;
      }
      spinner.succeed("Branches fetched successfully!");

      sourceBranch = await inquirer.prompt([
        {
          type: "list",
          name: "sourceBranch",
          message: "Select source branch:",
          choices: branches,
          pageSize: 40,
        },
      ]);
    } else {
      sourceBranch = lastUsedConfig.sourceBranch;
    }
  }
  if (
    lastUsedConfig.destinationBranches &&
    lastUsedConfig.destinationBranches.length > 0
  ) {
    const { reuseDestinationBranches } = await inquirer.prompt([
      {
        type: "confirm",
        name: "reuseDestinationBranches",
        message: `Do you want to re-create with these destination branches?\n - ${lastUsedConfig.destinationBranches.join(
          "\n - "
        )}\n`,
        default: true,
      },
    ]);
    if (reuseDestinationBranches) {
      for (const destBranch of lastUsedConfig.destinationBranches) {
        await createBitbucketPR(client, config, repo, sourceBranch, destBranch);
      }
    }
  }

  // Select destination branches (Multiple)
  const { destinationBranches } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "destinationBranches",
      message: "Select destination branch(es):",
      choices: branches.filter((b) => b !== sourceBranch),
      default: lastUsedConfig.destinationBranches || [],
      pageSize: 40,
      validate: (input) =>
        input.length > 0
          ? true
          : "You must select at least one destination branch.",
    },
  ]);

  // Store for future use
  saveConfig({ ...config, sourceBranch, destinationBranches });

  // Loop through selected destination branches to create PRs
  for (const destBranch of destinationBranches) {
    await createBitbucketPR(client, config, repo, sourceBranch, destBranch);
  }
};

const createBitbucketPR = async (
  client,
  config,
  repo,
  sourceBranch,
  destBranch
) => {
  const spinner = ora(
    `Creating PR from ${sourceBranch} to ${destBranch}...`
  ).start();

  try {
    const response = await client.post(
      `/repositories/${config.workspace}/${repo}/pullrequests`,
      {
        title: `Merge ${sourceBranch} into ${destBranch} created by CLI`,
        description: "Bring more bugs 🐞🐞🐞",
        source: { branch: { name: sourceBranch } },
        destination: { branch: { name: destBranch } },
        close_source_branch: false,
      }
    );

    spinner.succeed(`PR created: ${response.data.links.html.href}`);
  } catch (error) {
    spinner.fail(`Failed to create PR from ${sourceBranch} to ${destBranch}`);
    console.error(
      chalk.red(error.response?.data?.error?.message || error.message)
    );
  }
};
