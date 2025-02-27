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

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration file path
const CONFIG_FILE = path.join(os.homedir(), ".bitbucket-pr-cli.json");

export const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (error) {
    console.error("Error loading config:", error.message);
  }
  return {};
};

// Save configuration
export const saveConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green("Configuration saved successfully!"));
  } catch (error) {
    console.error("Error saving config:", error.message);
  }
};

export const getSourceBranch = (config, repo) => {
  try {
    if (config.sourceBranch) {
      const index = config.sourceBranch.findIndex((_) => _.repo === repo);
      if (index > -1) {
        return config.sourceBranch[index].source;
      }
    }
    return "";
  } catch (error) {
    return "";
  }
};

export const getDestinationBranches = (config, repo) => {
  try {
    if (config.destinationBranches) {
      const index = config.destinationBranches.findIndex((_) => _.repo === repo);
      if (index > -1) {
        return config.destinationBranches[index].destination;
      }
    }
    return [];
  } catch (error) {
    return [];
  }
};

export const saveSourceBranch = (config, repo, sourceBranch) => {
  try {
    if (config.sourceBranch) {
      const index = config.sourceBranch.findIndex((_) => _.repo === repo);
      if (index > -1) {
        config.sourceBranch[index] = {
          repo,
          source: sourceBranch,
        };
      } else {
        config.sourceBranch.push({ repo, source: sourceBranch });
      }
    } else {
      config.sourceBranch = [
        {
          repo,
          source: sourceBranch,
        },
      ];
    }
    saveConfig(config);
  } catch (error) {}
};

export const saveDestinationBranches = (config, repo, destinationBranches) => {
  try {
    if (config.destinationBranches) {
      const index = config.destinationBranches.findIndex((_) => _.repo === repo);
      if (index > -1) {
        config.destinationBranches[index] = {
          repo,
          destination: destinationBranches,
        };
      } else {
        config.destinationBranches.push({ repo, source: destinationBranches });
      }
    } else {
      config.destinationBranches = [
        {
          repo,
          destination: destinationBranches,
        },
      ];
    }
    saveConfig(config);
  } catch (error) {}
};

// Create Bitbucket API client
export const createClient = (config) => {
  const auth = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64"
  );

  return axios.create({
    baseURL: `https://api.bitbucket.org/2.0`,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });
};

// Configure the CLI
export const setupCLI = async () => {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "Enter your Bitbucket username:",
      validate: (input) => (input.length > 0 ? true : "Username is required"),
    },
    {
      type: "password",
      name: "password",
      message: "Enter your Bitbucket app password:",
      validate: (input) =>
        input.length > 0 ? true : "App password is required",
    },
    {
      type: "input",
      name: "workspace",
      message: "Enter your Bitbucket workspace:",
      validate: (input) => (input.length > 0 ? true : "Workspace is required"),
    },
  ]);

  saveConfig(answers);
  return answers;
};
