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
import { saveConfig } from "./config.js";

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const preCheckRepository = async (config) => {
  let repo;
  if (config.repos && config.repos.length > 0) {
    const { selectedRepo } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedRepo",
        message: "Select a repository:",
        choices: [
          ...config.repos,
          { name: "Add New Repository", value: "addNew" },
        ],
      },
    ]);

    if (selectedRepo === "addNew") {
      const { newRepo } = await inquirer.prompt([
        {
          type: "input",
          name: "newRepo",
          message: "Enter new repository name:",
          validate: (input) =>
            input.length > 0 ? true : "Repository is required",
        },
      ]);

      config.repos.push(newRepo);
      saveConfig(config);
      repo = newRepo;
    } else {
      repo = selectedRepo;
    }
    return repo;
  } else {
    console.log(chalk.yellow("No repositories saved. Please add one."));
    return manageRepositories(config);
  }
};

export const manageRepositories = async (config) => {
  if (!config.repos) {
    config.repos = [];
  }

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Manage repositories:",
      choices: [
        { name: "List Saved Repositories", value: "list" },
        { name: "Add Repository", value: "add" },
        { name: "Remove Repository", value: "remove" },
        { name: "Go Back", value: "back" },
      ],
    },
  ]);

  if (action === "list") {
    console.log(chalk.blue("Saved repositories:"));
    config.repos.forEach((repo, index) => console.log(`${index + 1}. ${repo}`));
  }

  if (action === "add") {
    const { newRepo } = await inquirer.prompt([
      {
        type: "input",
        name: "newRepo",
        message: "Enter new repository name:",
        validate: (input) =>
          input.length > 0 ? true : "Repository is required",
      },
    ]);

    config.repos.push(newRepo);
    saveConfig(config);
    console.log(chalk.green(`Repository "${newRepo}" added successfully!`));
  }

  if (action === "remove") {
    if (config.repos.length === 0) {
      console.log(chalk.red("No repositories saved."));
    } else {
      const { repoToRemove } = await inquirer.prompt([
        {
          type: "list",
          name: "repoToRemove",
          message: "Select a repository to remove:",
          choices: config.repos,
        },
      ]);

      config.repos = config.repos.filter((repo) => repo !== repoToRemove);
      saveConfig(config);
      console.log(chalk.yellow(`Repository "${repoToRemove}" removed!`));
    }
  }

  if (action !== "back") {
    return manageRepositories(config);
  }
};
