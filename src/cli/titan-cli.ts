import { Command } from 'commander';
import * as readline from 'node:readline';
import { CliConfigService } from './config.service.js';
import { TitanApiClient } from './api-client.js';

async function promptText(question: string, hide = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!hide) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    } else {
      process.stdout.write(question);
      let query = '';
      const onData = (char: Buffer) => {
        const str = char.toString('utf-8');
        if (str === '\r' || str === '\n' || str === '\u0004') {
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode?.(false);
          process.stdout.write('\n');
          rl.close();
          resolve(query.trim());
        } else if (str === '\u0003') {
          process.exit(1);
        } else if (str === '\b' || str === '\x7f') {
          if (query.length > 0) {
            query = query.slice(0, -1);
          }
        } else {
          query += str;
        }
      };

      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on('data', onData);
    }
  });
}

export function createCli(
  customConfigService?: CliConfigService,
  customApiClient?: TitanApiClient,
): Command {
  const configService = customConfigService || new CliConfigService();
  const program = new Command();

  program
    .name('titan')
    .description(
      'TitanPaaS Official CLI - Manage deployments, containers and logs',
    )
    .version('0.0.1');

  const getClient = (urlOverride?: string): TitanApiClient => {
    if (customApiClient) {
      return customApiClient;
    }
    const config = configService.getConfig();
    if (urlOverride) {
      config.apiUrl = urlOverride;
    }
    return new TitanApiClient(config);
  };

  // 1. titan login
  program
    .command('login')
    .description('Authenticate with the TitanPaaS platform')
    .option('-e, --email <email>', 'User email address')
    .option('-p, --password <password>', 'User password')
    .option(
      '-u, --url <url>',
      'TitanPaaS API URL (default: http://localhost:3000)',
    )
    .action(async (options) => {
      try {
        const apiUrl = options.url || configService.getConfig().apiUrl;
        let email = options.email;
        let password = options.password;

        if (!email) {
          email = await promptText('Email: ');
        }
        if (!password) {
          password = await promptText('Password: ', true);
        }

        if (!email || !password) {
          console.error('Error: Email and password are required.');
          process.exitCode = 1;
          return;
        }

        const client = getClient(apiUrl);
        const response = await client.login(email, password);

        configService.saveConfig({
          apiUrl,
          token: response.access_token,
          email: response.user?.email || email,
          userId: response.user?.id,
        });

        console.log(`Successfully logged in as ${email}`);
        console.log(`API URL: ${apiUrl}`);
      } catch (err) {
        console.error(`Login failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // 2. titan logout
  program
    .command('logout')
    .description('Log out and clear stored session')
    .action(() => {
      configService.clearAuth();
      console.log('Successfully logged out.');
    });

  // 3. titan whoami
  program
    .command('whoami')
    .description('Display current authenticated user profile')
    .action(async () => {
      try {
        const config = configService.getConfig();
        if (!config.token) {
          console.log("Not logged in. Please run 'titan login' first.");
          return;
        }

        const client = getClient();
        const profile = await client.getProfile();
        console.log(`Logged in as: ${profile.email} (${profile.name})`);
        console.log(`User ID: ${profile.id}`);
        console.log(`API URL: ${config.apiUrl}`);
      } catch (err) {
        console.error(`Error fetching profile: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // 4. titan status [projectId]
  program
    .command('status [projectId]')
    .description('View project status or list all projects')
    .action(async (projectId) => {
      try {
        const config = configService.getConfig();
        if (!config.token) {
          console.error("Authentication required. Run 'titan login' first.");
          process.exitCode = 1;
          return;
        }

        const client = getClient();
        const targetId = projectId || configService.getLocalProjectId();

        if (targetId) {
          const project = await client.getProject(targetId);
          console.log(`=== Project: ${project.name} ===`);
          console.log(`ID:           ${project.id}`);
          console.log(
            `Repository:   ${project.repositoryName} (${project.repositoryUrl})`,
          );
          console.log(`Branch:       ${project.branch}`);
          console.log(`Port:         ${project.port}`);

          if (project.customDomains && project.customDomains.length > 0) {
            const domains = project.customDomains
              .map((d) => `${d.domain} [${d.status}]`)
              .join(', ');
            console.log(`Domains:      ${domains}`);
          }

          const deploymentsData = await client.getDeployments(project.id);
          const latestDeploy = deploymentsData.items?.[0];

          if (latestDeploy) {
            console.log('\n--- Latest Deployment ---');
            console.log(`ID:           ${latestDeploy.id}`);
            console.log(`Status:       ${latestDeploy.status}`);
            console.log(
              `Commit:       ${latestDeploy.commitSha || 'N/A'} - ${latestDeploy.commitMessage || 'No message'}`,
            );
            console.log(`Container ID: ${latestDeploy.containerId || 'N/A'}`);
            console.log(`Started:      ${latestDeploy.startedAt || 'N/A'}`);
            console.log(`Finished:     ${latestDeploy.finishedAt || 'N/A'}`);
          } else {
            console.log('\nNo deployments found for this project.');
          }
        } else {
          const projects = await client.getProjects();
          if (projects.length === 0) {
            console.log('No projects found. Create one via dashboard or API.');
            return;
          }

          console.log(`Found ${projects.length} project(s):\n`);
          for (const proj of projects) {
            console.log(`- ${proj.name} (ID: ${proj.id})`);
            console.log(
              `  Repo: ${proj.repositoryName} | Branch: ${proj.branch} | Port: ${proj.port}`,
            );
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // 5. titan deploy [projectId]
  program
    .command('deploy [projectId]')
    .description('Trigger a deployment for a project')
    .option('-b, --branch <branch>', 'Target Git branch to deploy')
    .option('-c, --commit <commitSha>', 'Specific commit SHA to deploy')
    .option('-f, --follow', 'Follow deployment logs in real-time')
    .action(async (projectId, options) => {
      try {
        const config = configService.getConfig();
        if (!config.token) {
          console.error("Authentication required. Run 'titan login' first.");
          process.exitCode = 1;
          return;
        }

        const client = getClient();
        const targetId = projectId || configService.getLocalProjectId();

        if (!targetId) {
          console.error(
            'Error: Please specify a project ID or run inside a directory with .titanrc',
          );
          process.exitCode = 1;
          return;
        }

        console.log(`Triggering deployment for project ${targetId}...`);
        const result = await client.triggerDeploy(
          targetId,
          options.branch,
          options.commit,
        );

        console.log('Deployment queued successfully!');
        console.log(`Deployment ID: ${result.deploymentId}`);
        console.log(`Job ID:        ${result.jobId}`);
        console.log(`Status:        ${result.status}`);

        if (options.follow) {
          console.log('\n--- Following deployment logs ---');
          await followDeploymentLogs(client, result.deploymentId);
        }
      } catch (err) {
        console.error(`Deployment trigger failed: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  // 6. titan logs [target]
  program
    .command('logs [target]')
    .description(
      'Fetch or follow deployment logs (target can be deploymentId or projectId)',
    )
    .option('-f, --follow', 'Follow log stream until completion')
    .option('--format <format>', 'Log format: txt or json', 'txt')
    .action(async (target, options) => {
      try {
        const config = configService.getConfig();
        if (!config.token) {
          console.error("Authentication required. Run 'titan login' first.");
          process.exitCode = 1;
          return;
        }

        const client = getClient();
        const resolvedTarget = target || configService.getLocalProjectId();

        if (!resolvedTarget) {
          console.error(
            'Error: Please specify a deployment ID, project ID, or run inside a directory with .titanrc',
          );
          process.exitCode = 1;
          return;
        }

        // Detect if resolvedTarget is a deployment or project
        let deploymentId = resolvedTarget;
        try {
          await client.getDeployment(resolvedTarget);
        } catch {
          // If not a deployment, try resolving as projectId to get latest deployment
          try {
            const deploys = await client.getDeployments(resolvedTarget);
            if (deploys.items && deploys.items.length > 0) {
              deploymentId = deploys.items[0].id;
            } else {
              console.error(
                `No deployments found for project ${resolvedTarget}`,
              );
              process.exitCode = 1;
              return;
            }
          } catch {
            console.error(
              `Could not resolve deployment or project ID: ${resolvedTarget}`,
            );
            process.exitCode = 1;
            return;
          }
        }

        if (options.follow) {
          await followDeploymentLogs(client, deploymentId);
        } else {
          const logs = await client.getLogsDownload(
            deploymentId,
            options.format === 'json' ? 'json' : 'txt',
          );
          console.log(logs || 'No logs recorded for this deployment.');
        }
      } catch (err) {
        console.error(`Error retrieving logs: ${(err as Error).message}`);
        process.exitCode = 1;
      }
    });

  return program;
}

export async function followDeploymentLogs(
  client: TitanApiClient,
  deploymentId: string,
  pollIntervalMs = 1500,
): Promise<void> {
  let printedLength = 0;
  const terminalStatuses = ['DEPLOYED', 'FAILED', 'CANCELLED'];

  while (true) {
    try {
      const deploy = await client.getDeployment(deploymentId);
      const currentLogs = deploy.logs || '';

      if (currentLogs.length > printedLength) {
        const newLogs = currentLogs.slice(printedLength);
        process.stdout.write(newLogs);
        printedLength = currentLogs.length;
      }

      if (terminalStatuses.includes(deploy.status)) {
        console.log(`\nDeployment finished with status: ${deploy.status}`);
        break;
      }
    } catch (err) {
      console.error(
        `\nError polling deployment status: ${(err as Error).message}`,
      );
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(argv);
}
