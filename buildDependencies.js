const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const runCommand = (command, args = [], options = {}) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, options);

    // Display stdout in real-time
    process.stdout.on("data", (data) => {
      console.log(`[${command} stdout]: ${data.toString().trim()}`);
    });

    // Display stderr in real-time
    process.stderr.on("data", (data) => {
      console.error(`[${command} stderr]: ${data.toString().trim()}`);
    });

    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`Error executing: ${command} ${args.join(" ")}`);
        return reject(new Error(`Command exited with code ${code}`));
      }
      resolve(); // Resolve without returning any output
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
      await runCommand("git", ["clone", "-b", branch, url]);

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
      await runCommand("bash", ["buildScript.sh"]);

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
      console.log("Reading dependencies.json from main project...");
      const dependencies = JSON.parse(fs.readFileSync(dependenciesFilePath, "utf-8"));
      const timestamp = new Date().getTime();
      await runCommand("mkdir", [`dependencies_${timestamp}`]);
      const buildDependenciesPath = path.join(baseDir, `dependencies_${timestamp}`);
      await buildDependencies(dependencies, buildDependenciesPath);
    }
    process.chdir(path.join(baseDir, target));
    console.log(`Running build script for main project...`);
    await runCommand("bash", ["buildScript.sh"]);
  } catch (error) {
    console.error(`Failed to process main project: ${error.message}`);
  }
};

// Execute the script
main()
  .then(() => console.log("All dependencies built successfully!"))
  .catch((error) => console.error(`Script failed: ${error.message}`));
