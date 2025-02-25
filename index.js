#!/usr/bin/env node

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
import { createClient, loadConfig, saveConfig, setupCLI } from "./config.js";
import { manageRepositories, preCheckRepository } from "./repository.js";
import {
  listPullRequests,
  mergePullRequest,
  createPullRequest,
} from "./pullRequest.js";

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);

const showMainMenu = async (client, config) => {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "List Pull Requests", value: "list" },
        { name: "Create Pull Requests", value: "create" },
        { name: "Select Repository", value: "selectRepo" }, // NEW
        { name: "Configure CLI", value: "configure" },
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  if (action === "exit") {
    console.log(chalk.blue("Goodbye!"));
    return;
  }

  if (action === "configure") {
    await setupCLI();
    return showMainMenu(client, config);
  }

  if (action === "selectRepo") {
    await manageRepositories(config);
    return showMainMenu(client, config);
  }

  if (action === "create") {
    await createPullRequest(client, config);
    return showMainMenu(client, config);
  }

  if (["list"].includes(action)) {
    let repo = await preCheckRepository(config);

    if (action === "list") {
      const prs = await listPullRequests(client, config, repo);
      if (prs.length > 0) {
        const { selectedPRs } = await inquirer.prompt([
          {
            type: "checkbox",
            name: "selectedPRs",
            loop: false,
            message:
              "Select pull requests to merge (Press Space to select, Enter to confirm):",
            choices: prs.map((pr) => ({
              name: `#${pr.id}: ${pr.title} (${pr.source.branch.name} → ${pr.destination.branch.name})`,
              value: pr.id,
            })),
          },
        ]);

        if (selectedPRs.length === 0) {
          console.log(chalk.yellow("No PRs selected. Returning to main menu."));
          return showMainMenu(client, config);
        }

        const { confirmMerge } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmMerge",
            message: `Are you sure you want to merge ${selectedPRs.length} PR(s)?`,
            default: false,
          },
        ]);

        if (confirmMerge) {
          for (const prId of selectedPRs) {
            console.log(chalk.blue(`Merging PR #${prId}...`));
            await mergePullRequest(client, config, repo, prId);
          }
          console.log(chalk.green("All selected PRs have been merged!"));
        }
      }
    }
  }

  const { returnToMain } = await inquirer.prompt([
    {
      type: "confirm",
      name: "returnToMain",
      message: "Return to main menu?",
      default: true,
    },
  ]);

  if (returnToMain) {
    await showMainMenu(client, config);
  } else {
    console.log(chalk.blue("Goodbye!"));
  }
};

// Main function
async function main() {
  // Define simplified CLI with just one command
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: $0 [options]")
    .option("configure", {
      alias: "c",
      description: "Configure the CLI directly without the interactive menu",
      type: "boolean",
    })
    .help()
    .alias("help", "h")
    .version("1.0.0")
    .alias("version", "v")
    .wrap(100)
    .parse();

  // Load config or configure if not exists
  let config = loadConfig();

  if (
    argv.configure ||
    !config.username ||
    !config.password ||
    !config.workspace
  ) {
    config = await setupCLI();
  }

  // Create API client
  const client = createClient(config);

  // Show the main menu
  await showMainMenu(client, config);
}

// Run the program
main().catch((error) => {
  console.error(chalk.red("An error occurred:"), error);
  process.exit(1);
});
