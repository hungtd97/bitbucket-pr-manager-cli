import chalk from "chalk";

export const getBranches = async (client, config, repo) => {
  try {
    const response = await client.get(
      `/repositories/${config.workspace}/${repo}/refs/branches?pagelen=50`
    );
    return response.data.values.map((branch) => branch.name);
  } catch (error) {
    console.error(chalk.red("Failed to fetch branches:", error.message));
    return [];
  }
};

export const fetchBranchesPaginated = async (client, config, repo) => {
  let branches = [];
  let nextPageUrl = `/repositories/${config.workspace}/${repo}/refs/branches?pagelen=50`;

  while (nextPageUrl) {
    try {
      const response = await client.get(nextPageUrl);
      branches.push(...response.data.values.map((branch) => branch.name));

      // Check if there's a next page
      nextPageUrl = response.data.next || null;
    } catch (error) {
      console.error(chalk.red("Failed to fetch branches:", error.message));
      break;
    }
  }

  return branches;
};
