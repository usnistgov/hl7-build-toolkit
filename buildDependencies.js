const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Function to execute shell commands without displaying output
const runCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    const process = exec(command, options, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing: ${command}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        return reject(error);
      }
      // Suppress stdout and stderr in normal cases
      resolve(stdout);
    });
  });
};

// Function to recursively build dependencies
const buildDependencies = async (dependencies, dependenciesFolderPath) => {
  for (const { url, branch } of dependencies) {
    try {
      // Change directory to the dependencies folder
      process.chdir(dependenciesFolderPath);

      console.log(`Processing repository: ${url} (${branch})`);

      // Extract the repo name from the URL
      const repoName = url.split("/").pop().replace(".git", "");

      // Clone the repository
      console.log(`Cloning ${url}...`);
      const repoPath = path.join(dependenciesFolderPath, repoName);
      await runCommand(`git clone -b ${branch} ${url}`);


      // Check for dependencies.json in the cloned repo
      const dependenciesFilePath = path.join(repoPath, "dependencies.json");
      if (fs.existsSync(dependenciesFilePath)) {
        console.log(`Found dependencies.json in ${repoName}. Resolving dependencies...`);
        const nestedDependencies = JSON.parse(fs.readFileSync(dependenciesFilePath, "utf-8"));
        await buildDependencies(nestedDependencies, dependenciesFolderPath); // Use baseDir for nested dependencies
      }
      // Change directory to cloned repo
      process.chdir(repoPath);
      // Run the build script
      console.log(`Running build script for ${repoName}...`);
      await runCommand(`bash buildScript.sh`);

      // Return to the original directory
      process.chdir(dependenciesFolderPath);

      console.log(`Successfully built ${repoName}!\n`);
    } catch (error) {
      console.error(`Failed to process ${url}: ${error.message}\n`);
    }
  }
};

// Main function to initiate the process
const main = async () => {
  const baseDir = path.resolve(__dirname); // Start in the current directory

  try {
    const target = process.argv[2];
    const dependenciesFilePath = path.join(baseDir, target, "dependencies.json");

    if (fs.existsSync(dependenciesFilePath)) {
      // Read and process the initial dependencies.json
      console.log("Reading dependencies.json from  main project...");
      const dependencies = JSON.parse(fs.readFileSync(dependenciesFilePath, "utf-8"));

      await runCommand(`mkdir dependencies`);
      const buildDependenciesPath = path.join(baseDir, "dependencies");
      await buildDependencies(dependencies, buildDependenciesPath);
    }
    process.chdir(path.join(baseDir, target));
    console.log(`Running build script for main project...`);
    await runCommand(`bash buildScript.sh`);


  } catch (error) {
    console.error(`Failed to process main project: ${error.message}`);
  }
};

// Execute the script
main()
  .then(() => console.log("All dependencies built successfully!"))
  .catch((error) => console.error(`Script failed: ${error.message}`));
